/** Every page under /chitzonim lives in the outside world: the scoped tokens in globals.css. */
export default function ChitzonimLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-world="outside" className="outside-world">
      {children}
    </div>
  );
}
