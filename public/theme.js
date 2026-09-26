(function () {
  var root = document.documentElement;
  var btn = document.getElementById("theme-toggle");

  function current() {
    var saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function paint(mode) {
    root.setAttribute("data-theme", mode);
    btn.textContent = mode === "dark" ? "light" : "dark";
  }

  paint(current());

  btn.addEventListener("click", function () {
    var next = current() === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    paint(next);
  });
})();
