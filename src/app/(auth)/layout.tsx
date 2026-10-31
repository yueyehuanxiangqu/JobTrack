export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="flex min-h-dvh min-w-0 items-center justify-center bg-muted/40 px-2 py-6">
      {children}
    </main>
  );
}
