import Link from "next/link";
import type { OutsideArea } from "@/lib/chitzonim/outside";

export interface ThresholdArea {
  key: OutsideArea;
  title: string;
  summary: string;
  count: number;
  unit: "book" | "work";
}

function countText(count: number, unit: ThresholdArea["unit"]): string {
  if (count === 0) return "in preparation";
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

export function ThresholdAreas({ areas }: { areas: ThresholdArea[] }) {
  return (
    <ol className="threshold-areas">
      {areas.map((area) => (
        <li key={area.key} className="threshold-areas__item">
          <Link href={`/chitzonim/${area.key}`} className="threshold-areas__link">
            <span className="threshold-areas__title">{area.title}</span>{" "}
            <span className="threshold-areas__count">{countText(area.count, area.unit)}</span>
          </Link>{" "}
          <p className="threshold-areas__summary">{area.summary}</p>
        </li>
      ))}
    </ol>
  );
}
