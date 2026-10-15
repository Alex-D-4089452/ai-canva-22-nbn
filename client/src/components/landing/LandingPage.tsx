import { useState } from "react";
import { signInWithGoogle } from "../../lib/auth.js";
import LandingNav from "./LandingNav.js";
import LandingHero from "./LandingHero.js";
import LandingHowItWorks from "./LandingHowItWorks.js";
import LandingFeatures from "./LandingFeatures.js";
import LandingBoxes from "./LandingBoxes.js";
import LandingRoles from "./LandingRoles.js";
import LandingCTA from "./LandingCTA.js";
import LandingFooter from "./LandingFooter.js";
import { useTheme } from "./useTheme.js";

export default function LandingPage() {
  const [signingIn, setSigningIn] = useState(false);
  const { isDark, toggle } = useTheme();

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error("Sign-in failed:", e);
      setSigningIn(false);
    }
  };

  return (
    <div
      className={
        "landing-bg min-h-full w-full overflow-y-auto transition-colors " +
        (isDark ? "dark" : "")
      }
    >
      <LandingNav
        onSignIn={handleSignIn}
        signingIn={signingIn}
        isDark={isDark}
        onToggleTheme={toggle}
      />
      <main>
        <LandingHero onSignIn={handleSignIn} signingIn={signingIn} />
        <LandingHowItWorks />
        <LandingFeatures />
        <LandingBoxes />
        <LandingRoles />
        <LandingCTA onSignIn={handleSignIn} signingIn={signingIn} />
      </main>
      <LandingFooter />
    </div>
  );
}
