import { Flower2, Mountain } from "lucide-react";

export function ClassroomDecor() {
  return (
    <div className="classroom-decor" aria-hidden="true">
      <div className="classroom-decor__flowers">
        <Flower2 />
        <Flower2 />
        <Flower2 />
      </div>
      <div className="classroom-decor__landscape">
        <Mountain />
        <span className="classroom-decor__sun" />
      </div>
    </div>
  );
}
