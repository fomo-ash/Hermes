import { Request, Response, NextFunction } from "express";

export const loggerMiddleware =(
    req:Request, 
    res: Response, 
    next: NextFunction
)=>{
   
    const originalJson = res.json;

    res.json = function (body: any){
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📦 Response:");
        console.dir(body, { depth: null });
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━");
        
         return originalJson.call(this, body);
    }

    next();
    
}