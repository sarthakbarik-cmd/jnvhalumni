const form = document.querySelector('#registration');
const feedback = document.querySelector('#registration-status');
const submit = form.querySelector('button');
const inbox = 'https://firestore.googleapis.com/v1/projects/studio-8216248509-d2d60/databases/(default)/documents/contactMessages';
let attempt;

form.hidden = false;
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submit.disabled) return;

  const data = new FormData(form);
  const name = data.get('name').trim();
  const phone = data.get('phone').trim().replace(/[\s()-]/g, '');
  const batch = data.get('batch').trim();
  const meal = data.get('meal');
  const city = data.get('city').trim();
  if (!/^\+?\d{10,15}$/.test(phone)) {
    feedback.textContent = 'Enter a valid mobile number with 10 to 15 digits.';
    form.elements.phone.focus();
    return;
  }
  if (!name || !batch || !city || !['Veg', 'Non-veg'].includes(meal)) {
    feedback.textContent = 'Please complete all five registration fields.';
    return;
  }

  const values = {
    name, phone, batch, meal, city,
    email: '',
    subject: 'Reunion registration · 27 December 2026',
    message: `Mobile: ${phone}\nBatch: ${batch}\nMeal: ${meal}\nStarting city or town: ${city}`,
    status: 'unread',
    eventDate: '2026-12-27'
  };
  const signature = JSON.stringify(values);
  if (attempt?.signature !== signature) {
    attempt = { signature, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
  }

  const fields = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { stringValue: value }]));
  fields.createdAt = { timestampValue: attempt.timestamp };

  submit.disabled = true;
  feedback.textContent = 'Submitting your registration…';
  try {
    const url = new URL(inbox);
    url.searchParams.set('documentId', attempt.id);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      const result = await response.json();
      if (result.error?.status !== 'ALREADY_EXISTS') throw new Error('Registration failed');
    }
    form.reset();
    form.hidden = true;
    feedback.textContent = 'Registration received. Thank you!';
  } catch {
    feedback.textContent = 'We couldn’t confirm your registration. Please try again or email admin@jnvhalumni.com.';
  } finally {
    submit.disabled = false;
  }
});
