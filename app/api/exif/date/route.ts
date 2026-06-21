import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import { getExifForPaths, removeExifCache } from "@/lib/exifCacheServer";
import { resolveSafePath } from "@/lib/fs";
import {
  buildDatedFileName,
  formatExifLocal,
  formatExifUtc,
  formatLocalOffset,
  parseLocalDateTime,
  replaceBaseName,
} from "@/lib/mediaDateChange";

const execFileAsync = promisify(execFile);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".avi", ".mkv"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"]);

type DateChangeBody = {
  items?: string[];
  localDateTime?: string;
};

type PlannedItem = {
  sourcePath: string;
  sourceAbs: string;
  destinationPath: string;
  destinationAbs: string;
  backupAbs: string;
  kind: "image" | "video";
};

async function exists(filePath: string) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getVideoDurationSeconds(abs: string) {
  const { stdout } = await execFileAsync("exiftool", ["-j", "-n", "-Duration", abs], {
    maxBuffer: 1024 * 1024,
  });
  const value = Number((JSON.parse(stdout) as any[])?.[0]?.Duration);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("動画の長さを取得できません");
  }
  return value;
}

async function writeImageDates(item: PlannedItem, localValue: string) {
  await execFileAsync(
    "exiftool",
    [
      `-EXIF:CreateDate=${localValue}`,
      `-EXIF:ModifyDate=${localValue}`,
      `-EXIF:DateTimeOriginal=${localValue}`,
      `-FileCreateDate=${localValue}`,
      `-FileModifyDate=${localValue}`,
      item.sourceAbs,
    ],
    { maxBuffer: 4 * 1024 * 1024 }
  );
}

async function writeVideoDates(
  item: PlannedItem,
  localValue: string,
  creationDate: string,
  createDateUtc: string,
  modifyDateUtc: string
) {
  await execFileAsync(
    "exiftool",
    [
      `-QuickTime:CreateDate=${createDateUtc}`,
      `-QuickTime:ModifyDate=${modifyDateUtc}`,
      `-Keys:CreationDate=${creationDate}`,
      `-FileCreateDate=${localValue}`,
      `-FileModifyDate=${localValue}`,
      item.sourceAbs,
    ],
    { maxBuffer: 4 * 1024 * 1024 }
  );
}

function localExifValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function valueBySuffix(metadata: Record<string, unknown>, suffix: string) {
  const entry = Object.entries(metadata).find(([key]) => key.endsWith(`:${suffix}`));
  return entry ? String(entry[1]) : null;
}

async function verifyDates(
  abs: string,
  kind: "image" | "video",
  expected: {
    localValue: string;
    creationDate: string;
    videoModifyLocal?: string;
  }
) {
  const { stdout } = await execFileAsync(
    "exiftool",
    [
      "-j",
      "-G1",
      "-s",
      "-api",
      "QuickTimeUTC=1",
      "-CreateDate",
      "-ModifyDate",
      "-DateTimeOriginal",
      "-CreationDate",
      "-FileCreateDate",
      "-FileModifyDate",
      abs,
    ],
    { maxBuffer: 1024 * 1024 }
  );
  const metadata = ((JSON.parse(stdout) as Record<string, unknown>[])?.[0] ?? {});
  const mismatches: string[] = [];
  const expect = (key: string, expectedValue: string, allowOffset = false) => {
    const actual = String(metadata[key] ?? "");
    if (allowOffset ? !actual.startsWith(expectedValue) : actual !== expectedValue) {
      mismatches.push(key);
    }
  };

  if (kind === "image") {
    expect("ExifIFD:CreateDate", expected.localValue);
    expect("IFD0:ModifyDate", expected.localValue);
    expect("ExifIFD:DateTimeOriginal", expected.localValue);
  } else {
    expect("QuickTime:CreateDate", expected.localValue, true);
    expect("QuickTime:ModifyDate", expected.videoModifyLocal ?? "", true);
    expect("Keys:CreationDate", expected.creationDate);
  }

  const fileCreateDate = valueBySuffix(metadata, "FileCreateDate");
  const fileModifyDate = valueBySuffix(metadata, "FileModifyDate");
  if (!fileCreateDate?.startsWith(expected.localValue)) mismatches.push("FileCreateDate");
  if (!fileModifyDate?.startsWith(expected.localValue)) mismatches.push("FileModifyDate");

  if (mismatches.length > 0) {
    throw new Error(`更新を確認できないタグ: ${mismatches.join(", ")}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DateChangeBody;
    const items = Array.from(new Set(body.items ?? [])).filter(
      (item): item is string => typeof item === "string" && item.length > 0
    );
    if (items.length === 0) {
      return NextResponse.json({ error: "対象ファイルを選択してください" }, { status: 400 });
    }

    const { parts, date } = parseLocalDateTime(body.localDateTime);
    const localValue = formatExifLocal(parts);
    const offset = formatLocalOffset(date);
    const creationDate = `${localValue}${offset}`;
    const createDateUtc = formatExifUtc(date);

    const planned: PlannedItem[] = [];
    for (const sourcePath of items) {
      const { abs: sourceAbs, relative } = resolveSafePath(sourcePath);
      const stat = await fs.stat(sourceAbs);
      if (!stat.isFile()) throw new Error(`${sourcePath}: ファイルではありません`);

      const ext = path.extname(relative).toLowerCase();
      const kind = VIDEO_EXTENSIONS.has(ext)
        ? "video"
        : IMAGE_EXTENSIONS.has(ext)
          ? "image"
          : null;
      if (!kind) throw new Error(`${sourcePath}: 対応していない形式です`);

      const destinationName = buildDatedFileName(path.basename(relative), parts);
      const destinationPath = replaceBaseName(relative, destinationName);
      const { abs: destinationAbs } = resolveSafePath(destinationPath);
      const backupAbs = `${sourceAbs}_original`;
      if (await exists(backupAbs)) {
        throw new Error(`${sourcePath}: ExifToolのバックアップファイルが既に存在します`);
      }
      planned.push({
        sourcePath: relative,
        sourceAbs,
        destinationPath,
        destinationAbs,
        backupAbs,
        kind,
      });
    }

    const destinationSet = new Set<string>();
    const sourceSet = new Set(planned.map((item) => item.sourceAbs));
    for (const item of planned) {
      if (destinationSet.has(item.destinationAbs)) {
        throw new Error(`${item.destinationPath}: 変更後のファイル名が重複します`);
      }
      destinationSet.add(item.destinationAbs);
      if (
        item.destinationAbs !== item.sourceAbs &&
        !sourceSet.has(item.destinationAbs) &&
        (await exists(item.destinationAbs))
      ) {
        throw new Error(`${item.destinationPath}: 同名のファイルが存在します`);
      }
    }

    const results: Array<{
      sourcePath: string;
      path?: string;
      status: "updated" | "failed";
      error?: string;
      durationSeconds?: number;
    }> = [];

    for (const item of planned) {
      try {
        let durationSeconds: number | undefined;
        if (item.kind === "video") {
          durationSeconds = await getVideoDurationSeconds(item.sourceAbs);
          const modifyDate = new Date(date.getTime() + Math.round(durationSeconds) * 1000);
          await writeVideoDates(
            item,
            localValue,
            creationDate,
            createDateUtc,
            formatExifUtc(modifyDate)
          );
          await verifyDates(item.sourceAbs, item.kind, {
            localValue,
            creationDate,
            videoModifyLocal: localExifValue(modifyDate),
          });
        } else {
          await writeImageDates(item, localValue);
          await verifyDates(item.sourceAbs, item.kind, { localValue, creationDate });
        }

        if (item.destinationAbs !== item.sourceAbs) {
          await fs.rename(item.sourceAbs, item.destinationAbs);
        }
        await fs.rm(item.backupAbs);
        try {
          await removeExifCache([item.sourcePath, item.destinationPath]);
          await getExifForPaths([item.destinationPath], { force: true });
        } catch (cacheError) {
          console.error("Failed to refresh EXIF cache after date change", cacheError);
        }

        results.push({
          sourcePath: item.sourcePath,
          path: item.destinationPath,
          status: "updated",
          ...(durationSeconds === undefined ? {} : { durationSeconds }),
        });
      } catch (error: any) {
        let restoreError: string | null = null;
        try {
          if (await exists(item.backupAbs)) {
            if (item.destinationAbs !== item.sourceAbs && (await exists(item.destinationAbs))) {
              await fs.rm(item.destinationAbs);
            }
            if (await exists(item.sourceAbs)) await fs.rm(item.sourceAbs);
            await fs.rename(item.backupAbs, item.sourceAbs);
            await removeExifCache([item.sourcePath, item.destinationPath]);
          }
        } catch (restoreFailure: any) {
          restoreError = restoreFailure?.message ?? "元ファイルの復元に失敗しました";
        }
        results.push({
          sourcePath: item.sourcePath,
          status: "failed",
          error: [error?.message ?? "日時の変更に失敗しました", restoreError]
            .filter(Boolean)
            .join(" / "),
        });
      }
    }

    return NextResponse.json({
      ok: results.every((result) => result.status === "updated"),
      localDateTime: body.localDateTime,
      offset,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "日時の変更に失敗しました" },
      { status: 400 }
    );
  }
}
