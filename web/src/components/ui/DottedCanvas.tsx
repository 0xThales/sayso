export function DottedCanvas() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.25]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.5) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /></filter><rect width='100%25' height='100%25' filter='url(%23n)' /></svg>\")",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(255,255,255,0.7) 80%, rgba(255,255,255,0.95) 100%)",
        }}
      />
    </>
  );
}
