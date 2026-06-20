const checkoutButtons = document.querySelectorAll(".checkout-button");

checkoutButtons.forEach((checkoutButton) => {
  const paymentLink = checkoutButton.dataset.paymentLink;

  checkoutButton.addEventListener("click", (event) => {
    if (!paymentLink || paymentLink === "#") {
      event.preventDefault();
      alert("Add your payment link first, then set its success URL to intake.html.");
    }
  });
});

const query = new URLSearchParams(window.location.search);
const membershipPlan = document.querySelector("#membershipPlan");

if (membershipPlan) {
  const plan = query.get("plan");
  if (["starter", "pro", "custom"].includes(plan)) membershipPlan.value = plan;
}

const creditInput = document.querySelector("#creditAmount");
const creditTotal = document.querySelector("#creditTotal");
const topupButton = document.querySelector("#topupButton");

function updateTopup() {
  if (!creditInput || !creditTotal || !topupButton) return;
  const credits = Math.min(100, Math.max(1, Number.parseInt(creditInput.value, 10) || 1));
  creditInput.value = credits;
  creditTotal.textContent = `$${credits * 3}`;
  topupButton.textContent = `Add ${credits} Credit${credits === 1 ? "" : "s"}`;
  topupButton.href = `contact.html?request=topup&credits=${credits}`;
}

document.querySelectorAll(".credit-step").forEach((button) => {
  button.addEventListener("click", () => {
    if (!creditInput) return;
    creditInput.value = (Number.parseInt(creditInput.value, 10) || 1) + Number(button.dataset.step);
    updateTopup();
  });
});

creditInput?.addEventListener("input", updateTopup);
updateTopup();

const requestType = document.querySelector("#requestType");
if (requestType && query.get("request") === "topup") requestType.value = "top-up";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!reduceMotion) {
  const revealTargets = document.querySelectorAll(
    ".section-heading, .process-film, .work-card, .difference-grid article, .step, .pricing-copy, .mini-plan, .membership-card, .topup-calculator, .comparison-table-wrap, .faq-grid, .brief-form, .brief-aside, .response-promise, .final-cta"
  );

  revealTargets.forEach((target, index) => {
    target.classList.add("reveal-ready");
    target.style.setProperty("--reveal-index", String(index % 4));
  });

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8%", threshold: 0.08 }
  );

  revealTargets.forEach((target) => revealObserver.observe(target));

}
