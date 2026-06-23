import express from "express";
import cors from "cors";
import helmet from "helmet";

import routes from "./routes";
import { errorMiddleware } from "./middleware/error.middleware";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use(routes);

app.use(errorMiddleware);

export default app;
