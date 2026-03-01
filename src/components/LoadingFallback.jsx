export default function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-ocean-950">
      <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
