import passport  from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import {env} from "./env"
import {  PrismaClient } from "@prisma/client";

const prisma  = new PrismaClient();

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:8000/api/v1/auth/google/callback",
    },
    async  (accessToken , refreshToken, profile, done )=>{
        try {
          const email = profile.emails?.[0].value;
          if (!email) {
            return done(
              new Error("No email returned from Google profile configuration"),
              undefined,
            );
          }

          const user = await prisma.user.upsert({
            where: {
              provider_providerId: {
                provider: "GOOGLE",
                providerId: profile.id,
              },
            },
            update: {
              name: profile.displayName,
              imageUrl: profile.photos?.[0]?.value,
            },
            create: {
              email,
              name: profile.displayName,
              imageUrl: profile.photos?.[0]?.value,
              provider: "GOOGLE",
              providerId: profile.id,
            },
          });

          return done(null, user);
        } catch (error) {
            return done(error, undefined);
        }
    },
  ),
);