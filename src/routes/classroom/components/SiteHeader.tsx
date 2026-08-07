import { Settings } from "lucide-react";
import { Link } from "react-router-dom";

import { APP_ROUTES } from "../../../app/routes";
import { BrandMark } from "./BrandMark";

export function SiteHeader() {
  return (
    <header className="site-header">
      <BrandMark />
      <Link className="setup-link" to={APP_ROUTES.setup}>
        <Settings aria-hidden="true" />
        Teacher Setup
      </Link>
    </header>
  );
}
