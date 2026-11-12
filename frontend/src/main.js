import './style.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const form = document.querySelector('#task-form');
const titleInput = document.querySelector('#title');
const descriptionInput = document.querySelector('#description');
const list = document.querySelector('#task-list');
const formMessage = document.querySelector('#form-message');
const listMessage = document.querySelector('#list-message');
const submitButton = document.querySelector('#submit-button');
const cancelButton = document.querySelector('#cancel-button');
const connectionStatus = document.querySelector('#connection-status');
let editingId = null;

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || `Error del servidor (${response.status})`);
  }

  return response.status === 204 ? null : response.json();
}

function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function makeTaskElement(task) {
  const item = document.createElement('li');
  item.className = 'task-card';

  const content = document.createElement('div');
  content.className = 'task-content';
  const title = document.createElement('h3');
  title.textContent = task.title;
  content.append(title);

  if (task.description) {
    const description = document.createElement('p');
    description.textContent = task.description;
    content.append(description);
  }

  const date = document.createElement('time');
  date.className = 'task-date';
  date.dateTime = task.created_at;
  date.textContent = `Creada ${new Date(task.created_at).toLocaleString('es')}`;
  content.append(date);

  const actions = document.createElement('div');
  actions.className = 'task-actions';
  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'button-secondary';
  editButton.textContent = 'Editar';
  editButton.addEventListener('click', () => startEditing(task));

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'button-danger';
  deleteButton.textContent = 'Eliminar';
  deleteButton.addEventListener('click', () => deleteTask(task));

  actions.append(editButton, deleteButton);
  item.append(content, actions);
  return item;
}

async function loadTasks() {
  showMessage(listMessage, 'Cargando tareas…');
  list.replaceChildren();

  try {
    const tasks = await request('/tasks');
    list.append(...tasks.map(makeTaskElement));
    showMessage(listMessage, tasks.length ? '' : 'Todavía no hay tareas. ¡Crea la primera!');
    connectionStatus.textContent = 'API conectada';
    connectionStatus.classList.add('connected');
  } catch (error) {
    showMessage(listMessage, `No se pudieron cargar las tareas: ${error.message}`, true);
    connectionStatus.textContent = 'API sin conexión';
    connectionStatus.classList.remove('connected');
  }
}

function startEditing(task) {
  editingId = task.id;
  titleInput.value = task.title;
  descriptionInput.value = task.description || '';
  document.querySelector('#form-title').textContent = 'Editar tarea';
  submitButton.textContent = 'Guardar cambios';
  cancelButton.hidden = false;
  showMessage(formMessage, '');
  titleInput.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  editingId = null;
  form.reset();
  document.querySelector('#form-title').textContent = 'Nueva tarea';
  submitButton.textContent = 'Crear tarea';
  cancelButton.hidden = true;
  showMessage(formMessage, '');
}

async function deleteTask(task) {
  if (!window.confirm(`¿Eliminar "${task.title}"?`)) return;

  try {
    await request(`/tasks/${task.id}`, { method: 'DELETE' });
    if (editingId === task.id) resetForm();
    await loadTasks();
  } catch (error) {
    showMessage(listMessage, `No se pudo eliminar la tarea: ${error.message}`, true);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  showMessage(formMessage, '');

  const wasEditing = editingId !== null;
  const payload = {
    title: titleInput.value.trim(),
    description: descriptionInput.value.trim(),
  };

  try {
    await request(editingId ? `/tasks/${editingId}` : '/tasks', {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
    resetForm();
    showMessage(formMessage, wasEditing ? 'Tarea actualizada.' : 'Tarea creada.');
    await loadTasks();
  } catch (error) {
    showMessage(formMessage, error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

cancelButton.addEventListener('click', resetForm);
document.querySelector('#refresh-button').addEventListener('click', loadTasks);
loadTasks();
