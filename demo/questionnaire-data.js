/** Combines the four independently loaded goal questionnaires. */
(function (global) {
  const goals = ["weight_loss","weight_gain","pregnancy","detox"].map((id) => global.SABZINE_GOALS[id]);
  global.SABZINE_QUESTIONNAIRE = { goals };
})(window);
