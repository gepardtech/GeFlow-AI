import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const CTASection = () => (
  <section className="py-12 sm:py-16 md:py-20">
    <div className="container mx-auto px-4 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-12 md:p-16 text-center border border-primary/20 bg-gradient-to-br from-primary/15 via-secondary/15 to-primary/10 dark:from-primary/10 dark:via-secondary/10 dark:to-card dark:border-border/80 shadow-xl max-w-5xl mx-auto min-w-0">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-foreground mb-3 sm:mb-4">
          Start managing your business smarter today
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-6 sm:mb-8 text-xs sm:text-sm md:text-base leading-relaxed">
          Join modern businesses streamlining their operations, inventory, and point-of-sale.
        </p>
        <Button
          size="lg"
          className="cta-btn bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-6 sm:px-8 w-full sm:w-auto rounded-full shadow-lg shadow-primary/25"
          asChild
        >
          <Link to="/signup">Create Free Account</Link>
        </Button>
      </div>
    </div>
  </section>
);

export default CTASection;
