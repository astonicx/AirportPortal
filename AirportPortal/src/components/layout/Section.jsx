export default function Section({ children, className = "" }) {
  return (
    <section className={`py-12 ${className}`}>
      {children}
    </section>
  );
}
