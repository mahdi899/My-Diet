(function () {
  function bind(root, qIdx, onSubmit) {
    const picker = root.querySelector(`[data-sleep-wake-picker="${qIdx}"]`);
    if (!picker) return;

    picker.querySelectorAll('[data-swp-display]').forEach((field) => {
      const target = field.dataset.swpDisplay;
      const input = picker.querySelector(`input[data-${target}-hour-index="${qIdx}"]`);
      const box = field.closest('.swp-value-box');
      const persian = (value) => String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
      const digits = (value) => value.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^0-9]/g, '');

      function set(value) {
        input.value = String(value);
        field.value = persian(value);
        field.setAttribute('aria-valuenow', String(value));
      }
      function commit() {
        const value = digits(field.value);
        set(value === '' ? Number(input.value) : Math.min(23, Number(value)));
      }
      function bump(delta) {
        commit();
        set(((Number(input.value) + delta) % 24 + 24) % 24);
      }

      field.addEventListener('focus', () => field.select());
      field.addEventListener('input', () => {
        const value = digits(field.value);
        if (value === '') {
          field.value = '';
          return;
        }
        const hour = Math.min(23, Number(value));
        input.value = String(hour);
        field.setAttribute('aria-valuenow', String(hour));
        field.value = value === String(hour) ? value : String(hour);
      });
      field.addEventListener('blur', commit);
      field.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          bump(event.key === 'ArrowUp' ? 1 : -1);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          field.blur();
        }
      });

      picker.querySelectorAll(`[data-swp-target="${target}"]`).forEach((button) => {
        button.addEventListener('click', () => bump(Number(button.dataset.swpDelta)));
      });

      let wheelDelta = 0;
      let lastWheelAt = 0;
      box.addEventListener('wheel', (event) => {
        if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
        event.preventDefault();
        if (event.timeStamp - lastWheelAt > 200) wheelDelta = 0;
        lastWheelAt = event.timeStamp;
        wheelDelta += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.clientHeight : 1);
        if (Math.abs(wheelDelta) >= 32) {
          bump(Math.sign(wheelDelta));
          wheelDelta = 0;
        }
      }, { passive: false });

      let drag = null;
      let suppressClick = false;
      box.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary || event.button !== 0) return;
        suppressClick = false;
        drag = { id: event.pointerId, y: event.clientY, moved: false };
      });
      box.addEventListener('pointermove', (event) => {
        if (!drag || drag.id !== event.pointerId) return;
        const steps = Math.trunc((drag.y - event.clientY) / 24);
        if (!steps) return;
        event.preventDefault();
        box.setPointerCapture(event.pointerId);
        drag.moved = true;
        drag.y -= steps * 24;
        bump(steps);
      });
      function finishDrag(event) {
        if (!drag || drag.id !== event.pointerId) return;
        suppressClick = drag.moved;
        drag = null;
        if (box.hasPointerCapture(event.pointerId)) box.releasePointerCapture(event.pointerId);
      }
      box.addEventListener('pointerup', finishDrag);
      box.addEventListener('pointercancel', finishDrag);
      box.addEventListener('lostpointercapture', finishDrag);
      box.addEventListener('click', (event) => {
        if (suppressClick) {
          event.preventDefault();
          suppressClick = false;
        }
      }, true);
    });

    picker.querySelector(`[data-sleep-wake-submit="${qIdx}"]`)?.addEventListener('click', () => {
      picker.querySelectorAll('[data-swp-display]').forEach((field) => field.blur());
      onSubmit(qIdx);
    });
  }

  window.mydietSleepWake = { bind };
})();
