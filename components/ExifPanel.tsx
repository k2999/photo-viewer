"use client";

import { useEffect } from "react";
import type { Entry } from "@/components/ViewerContext";
import { useExif } from "@/hooks/useExif";

export function ExifPanel({ entry }: { entry: Entry | null }) {
  const enabled = !!entry && entry.type !== "dir" && entry.type !== "other";
  const { exif, loading } = useExif(entry?.relativePath ?? null, enabled);

  return (
    <div className="exif-panel">
      <div className="exif-title">EXIF</div>

      {loading && <div>loading...</div>}

      {!loading && !exif && <div style={{ color: "#666" }}>no exif</div>}

      {!loading && exif && (
        <table className="exif-table">
          <tbody>
            {Object.entries(exif).map(([k, v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td>{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
