import { Router } from "express";
import * as authCtrl from "../controllers/auth.js";

const router = Router();

/*--------- Public Routes ---------*/
router.post("/signup", authCtrl.signup);
router.post("/addStudent", authCtrl.addStudent);
router.post("/login", authCtrl.login);

export { router }