import { LogOut, School } from "lucide-react";
import { Link } from "react-router-dom";

import { APP_ROUTES } from "../../../app/routes";
import { BrandMark } from "../../classroom/components/BrandMark";

interface TeacherSetupHeaderProps {
  authenticated: boolean;
  isLoggingOut: boolean;
  onLogout: () => void;
}

export function TeacherSetupHeader({
  authenticated,
  isLoggingOut,
  onLogout,
}: TeacherSetupHeaderProps) {
  return (
    <header className="teacher-setup__header">
      <BrandMark />
      <nav className="teacher-setup__header-actions" aria-label="Teacher navigation">
        <Link className="teacher-setup__classroom-link" to={APP_ROUTES.classroom}>
          <School aria-hidden="true" />
          Classroom Mode
        </Link>
        {authenticated ? (
          <button
            className="teacher-setup__logout"
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
          >
            <LogOut aria-hidden="true" />
            {isLoggingOut ? "Signing out…" : "Sign Out"}
          </button>
        ) : null}
      </nav>
    </header>
  );
}
