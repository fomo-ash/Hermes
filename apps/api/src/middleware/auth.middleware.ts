import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

const PUBLIC_ROUTES = [
  "/",
  "/health",
  "/api/v1/auth/google",
  "/api/v1/auth/google/callback",
  "/api/v1/onboarding/check-username",
];

export const authMiddelware = (
  req: Request , 
  res: Response , 
  next: NextFunction
)=> {

  const token = req.cookies?.token;
  
  if ( token ){
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        id: string, 
        email: string
      }
    
      req.user = decoded

    }

    catch(error){ 
      //clear the cookie if - session is invalid and it is a protected route

      if  ( !PUBLIC_ROUTES.includes(req.path)){
        res.clearCookie("token");
        return res.status(401).json({error: "Access Denied: Invalid or expired session token"})
      }
      
    }
  }
  // for non public route-- enforce validation 
  if (!PUBLIC_ROUTES.includes(req.path) && !req.user) {
    return res
      .status(401)
      .json({ error: "Access Denied: No session token found" });
  }
  next();

}