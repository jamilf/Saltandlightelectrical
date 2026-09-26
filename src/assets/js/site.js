// Salt and Light Electrical: form helpers. The forms work without this script; it adds
// clear error messages, quietly drops bot submissions caught by the honeypot, and can
// send a form without leaving the page when data-ajax="true".
(function () {
  'use strict';

  function fieldError(input) {
    var value = input.value.trim();
    if (input.required && !value) return input.getAttribute('data-missing') || 'Fill in this field.';
    if (input.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return input.getAttribute('data-invalid') || 'Enter an email address with an @, like name@example.com.';
    }
    return '';
  }

  function showError(input, message) {
    var box = document.getElementById(input.id + '-error');
    var field = input.closest('.field');
    var described = (input.getAttribute('aria-describedby') || '').split(' ').filter(function (id) {
      return id && id !== input.id + '-error';
    });
    if (message) {
      described.push(input.id + '-error');
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
    if (described.length) input.setAttribute('aria-describedby', described.join(' '));
    else input.removeAttribute('aria-describedby');
    if (field) field.classList.toggle('field--error', Boolean(message));
    if (box) {
      box.textContent = message;
      box.hidden = !message;
    }
  }

  function finish(form, text, isError) {
    var message = form.querySelector('.form-message');
    if (!message) {
      message = document.createElement('p');
      message.setAttribute('role', isError ? 'alert' : 'status');
      form.appendChild(message);
    }
    message.className = 'form-message' + (isError ? ' form-message--error' : '');
    message.textContent = text;
    if (!isError) {
      Array.prototype.forEach.call(form.querySelectorAll('.field, .hp, button'), function (el) {
        el.hidden = true;
      });
      message.setAttribute('tabindex', '-1');
      message.focus();
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll('form[data-form]'), function (form) {
    form.noValidate = true;
    var inputs = form.querySelectorAll('.field input, .field select, .field textarea');

    Array.prototype.forEach.call(inputs, function (input) {
      input.addEventListener('blur', function () {
        if (input.getAttribute('aria-invalid') === 'true') showError(input, fieldError(input));
      });
    });

    form.addEventListener('submit', function (event) {
      var trap = form.querySelector('.hp input');
      if (trap && trap.value) {
        event.preventDefault();
        finish(form, form.getAttribute('data-success'), false);
        return;
      }

      var firstBad = null;
      Array.prototype.forEach.call(inputs, function (input) {
        var message = fieldError(input);
        showError(input, message);
        if (message && !firstBad) firstBad = input;
      });
      if (firstBad) {
        event.preventDefault();
        firstBad.focus();
        return;
      }

      if (form.getAttribute('data-ajax') !== 'true' || !window.fetch) return;
      event.preventDefault();
      var button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (response) {
          if (!response.ok) throw new Error(String(response.status));
          finish(form, form.getAttribute('data-success'), false);
        })
        .catch(function () {
          button.disabled = false;
          finish(form, "That didn't send. Check you're online and try again.", true);
        });
    });
  });
})();
