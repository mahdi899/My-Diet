document.querySelectorAll('.transfer-number').forEach(button => {
  button.addEventListener('click', async () => {
    const feedback = button.closest('.transfer-card').nextElementSibling;
    try {
      await navigator.clipboard.writeText('5859831818609595');
      feedback.textContent = 'شماره کارت کپی شد';
    } catch {
      feedback.textContent = 'کپی خودکار انجام نشد؛ شماره کارت را انتخاب و کپی کنید.';
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(button.querySelector('b'));
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });
});
