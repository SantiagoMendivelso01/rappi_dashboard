export function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card-rappi p-5 h-32" />
        ))}
      </div>
      <div className="card-rappi p-5 h-28" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-rappi p-5 h-80" />
        <div className="card-rappi p-5 h-80" />
        <div className="card-rappi p-5 h-80" />
        <div className="card-rappi p-5 h-80" />
      </div>
      <div className="card-rappi p-5 h-96" />
    </div>
  );
}
