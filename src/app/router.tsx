import { createBrowserRouter } from "react-router-dom";

import { ClassroomRoute } from "../routes/classroom/ClassroomRoute";
import { FeedbackRoute } from "../routes/feedback/FeedbackRoute";
import { ReflectionRoute } from "../routes/reflection/ReflectionRoute";
import { TeacherSetupRoute } from "../routes/setup/TeacherSetupRoute";
import { APP_ROUTES } from "./routes";

export const appRouter = createBrowserRouter([
  {
    path: APP_ROUTES.classroom,
    Component: ClassroomRoute,
  },
  {
    path: APP_ROUTES.feedback,
    Component: FeedbackRoute,
  },
  {
    path: APP_ROUTES.reflection,
    Component: ReflectionRoute,
  },
  {
    path: APP_ROUTES.setup,
    Component: TeacherSetupRoute,
  },
]);
