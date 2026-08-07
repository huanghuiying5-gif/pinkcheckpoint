import { Flower2, Mountain } from "lucide-react";

export function ReflectionDecor() {
  return (
    <div className="reflection-decor" aria-hidden="true">
      <div className="reflection-decor__flowers">
        <Flower2 />
        <Flower2 />
        <Flower2 />
      </div>
      <div className="reflection-decor__landscape">
        <Mountain />
        <Mountain />
      </div>
    </div>
  );
}
