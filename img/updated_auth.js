
// Flip functionality
$(document).on("click", ".toggle-form", function () {
  $(".form-box").toggleClass("d-none"); // Toggle visibility between forms
  adjustFormHeight();
});

// Adjust the form container height dynamically
function adjustFormHeight() {
  const $activeForm = $(".form-box:not(.d-none)");
  $(".form-container").css("height", $activeForm.outerHeight());
}

// Adjust height on page load
$(document).ready(function () {
  adjustFormHeight(); // Set initial height
});
