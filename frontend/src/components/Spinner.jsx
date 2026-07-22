export default function Spinner({ className = '' }) {
  return (
    <span
      className={`inline-block w-5 h-5 rounded-full border-2 border-border border-t-accent animate-spin [animation-duration:0.8s] ${className}`}
    />
  )
}
