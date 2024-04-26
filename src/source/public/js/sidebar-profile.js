const sideBarBtns = document.querySelectorAll(
  ".account-profile-main .js-sidebar-btn"
);

function setDefault() {
  sideBarBtns.forEach((sideBarBtn) => {
    sideBarBtn.classList.remove("bg-blue");
  });
}

sideBarBtns.forEach((sideBarBtn) => {
  sideBarBtn.addEventListener("click", setDefault);
});
