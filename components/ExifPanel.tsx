"use client";

import { useEffect, useState } from "react";
import type { Entry } from "@/components/ViewerContext";

export function ExifPanel({ entry }: { entry: Entry | null }) {
  const [exif, setExif] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!entry || entry.type === "dir" || entry.type === "other") {
      setExif(null);
      return;
    }

    setLoading(true);
    fetch(`/api/exif?path=${encodeURIComponent(entry.relativePath)}`)
      .then((r) => r.json())
      .then((data) => setExif(data.exif ?? null))
      .catch(() => setExif(null))
      .finally(() => setLoading(false));
  }, [entry]);

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
