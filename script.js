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

const billingRegion = document.querySelector("#billingRegion");

if (billingRegion) {
  const region = new URLSearchParams(window.location.search).get("region");

  if (region === "india" || region === "international") {
    billingRegion.value = region;
  }
}
