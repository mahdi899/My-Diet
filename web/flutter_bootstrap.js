{{flutter_js}}
{{flutter_build_config}}
_flutter.loader.load({
  config: { canvasKitBaseUrl: 'canvaskit/' },
  onEntrypointLoaded: async function(engineInitializer) {
    const appRunner = await engineInitializer.initializeEngine();
    await appRunner.runApp();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById('startup-logo')?.remove();
    }));
  }
});
