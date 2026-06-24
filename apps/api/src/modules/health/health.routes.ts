import { error } from "console";
import { Router } from "express";
import { success } from "zod";

const router = Router()

router.get("/", (_req, res )=> {
    res.status(200).json({
        success:true,
        data: {
            status: "healthy"
        },
        error: null,
    })
})

export default router