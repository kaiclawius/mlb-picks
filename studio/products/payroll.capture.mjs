// What the camera sees for the Payroll.exe video. The site runs locally in recorded-round mode
// (no API key needed), so every capture is the same and nothing costs money.
export default {
  serve: "../coins/payroll",
  viewport: { width: 1920, height: 1080 },
  clips: [
    { name: "hero", steps: [{ goto: "/?mode=recorded" }, { wait: 6000 }] },
    { name: "round", steps: [
      { goto: "/?mode=recorded" },
      { scroll: "#office", offset: 24, smooth: false, wait: 400 },
      { mark: "start", wait: 1200 },
      { type: ["#missionInput", "launch a coffee brand for night-shift nurses"], wait: 600 },
      { click: "#runBtn" },
      { waitFor: "document.querySelector('#status').textContent.startsWith('Round closed')", wait: 1500 },
      { scroll: ".desk", offset: 150, wait: 7000 },
    ] },
  ],
};
