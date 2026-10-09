import clsx from "clsx";
import { isOutsideBook } from "@/lib/chitzonim/outside";

/** The scoped world of the outside books: `data-world` redefines the surface tokens beneath it. */
export function OutsideWorld({ bookId, className, children }: { bookId: number; className?: string; children: React.ReactNode }) {
  if (!isOutsideBook(bookId)) return <>{children}</>;
  return (
    <div data-world="outside" className={clsx("outside-world", className)}>
      {children}
    </div>
  );
}
