//=====================
// DARK MODE TOGGLE
// =====================
function toggleDark() {
  document.body.classList.toggle("dark");

  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );
}

// =====================
// SAVE DATA
// =====================
async function saveData(event, type) {
  event.preventDefault();

  let title = document.getElementById("title").value;
  let fileInputs = event.target.querySelectorAll("input[type='file']");

  // collect all selected files from all file inputs
  let fileList = Array.from(fileInputs).flatMap(inp => Array.from(inp.files || []));

  // read files as data URLs so they can be downloaded later
  let readFile = (file) => new Promise((res, rej) => {
    let fr = new FileReader();
    fr.onload = () => res({ name: file.name, url: fr.result });
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });

  let filesData = [];
  if (fileList.length) {
    try {
      filesData = await Promise.all(fileList.map(readFile));
    } catch (e) {
      alert('Error reading files');
      return;
    }
  }

  let data = JSON.parse(localStorage.getItem(type)) || [];

  data.push({
    title: title,
    files: filesData,
    date: new Date().toLocaleString()
  });

  localStorage.setItem(type, JSON.stringify(data));

  event.target.reset();
  alert("Upload saved!");

  displayData(type);
  updateDashboard();
}

// =====================
// DISPLAY DATA
// =====================
function sortUploads(type, items) {
  let sorted = Array.from(items);
  if (type === 'quiz') {
    sorted.sort((a, b) => {
      let titleA = (a.title || '').toUpperCase();
      let titleB = (b.title || '').toUpperCase();

      const weight = title => {
        if (title.includes('LONG QUIZ MIDTERM')) return 2;
        if (title.includes('MIDTERM')) return 1;
        if (title.includes('FINAL')) return 3;
        return 4;
      };

      let weightA = weight(titleA);
      let weightB = weight(titleB);

      if (weightA !== weightB) return weightA - weightB;
      return titleA.localeCompare(titleB);
    });
  } else {
    sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }
  return sorted;
}

function displayData(type) {
  let list = document.getElementById("list");
  if (!list) return;

  list.innerHTML = "";

  let data = JSON.parse(localStorage.getItem(type)) || [];
  data = sortUploads(type, data);

  data.forEach((item, index) => {
    let li = document.createElement("li");

    let filesHtml = '';
    if (Array.isArray(item.files) && item.files.length) {
      filesHtml = item.files.map(f => {
        if (typeof f === 'string') {
          return `<small>${f}</small>`;
        }

        // For exam uploads: show inline image only when the title or filename indicates MIDTERM
        if (type === 'exam' && f && f.url && (f.url.startsWith('data:image') || isImageUrl(f.url))) {
          const titleUpper = (item.title || '').toUpperCase();
          const nameUpper = (f.name || '').toUpperCase();
          if (titleUpper.includes('MIDTERM') || nameUpper.includes('MIDTERM')) {
            return `<img src="${f.url}" alt="${f.name}" class="quiz-img" />`;
          }
          return `<a href="${f.url}" download="${f.name}">${f.name}</a>`;
        }

        if (f && f.url && (f.url.startsWith('data:image') || isImageUrl(f.url))) {
          return `<img src="${f.url}" alt="${f.name}" class="quiz-img" />`;
        }

        if (f && f.url) {
          return `<a href="${f.url}" download="${f.name}">${f.name}</a>`;
        }
        return `<small>${f && f.name ? f.name : 'file'}</small>`;
      }).join(' <span>•</span> ');
    }

    li.innerHTML = `
      <div>
        <strong>${item.title}</strong><br>
        ${filesHtml}<br>
        <small>${item.date}</small>
      </div>
    `;

    let btn = document.createElement("button");
    btn.textContent = "Delete";

    btn.onclick = () => {
      data.splice(index, 1);
      localStorage.setItem(type, JSON.stringify(data));
      displayData(type);
      updateDashboard();
    };

    li.appendChild(btn);
    list.appendChild(li);
  });
}

// =====================
// DASHBOARD UPDATE
// =====================
function updateDashboard() {
  let quiz = JSON.parse(localStorage.getItem("quiz")) || [];
  let lab = JSON.parse(localStorage.getItem("lab")) || [];
  let exam = JSON.parse(localStorage.getItem("exam")) || [];

  let quizCount = document.getElementById("quizCount");
  let labCount = document.getElementById("labCount");
  let examCount = document.getElementById("examCount");

  if (quizCount) quizCount.textContent = quiz.length;
  if (labCount) labCount.textContent = lab.length;
  if (examCount) examCount.textContent = exam.length;

  renderUploadList('quiz', 'quizList');
  renderUploadList('lab', 'labList');
  renderUploadList('exam', 'examList');
}

function isImageUrl(url) {
  return /\.(jpe?g|png|gif|webp)$/i.test(url);
}

// Convert local image files referenced by filename into data URLs and save
async function ensureLocalFilesDataURLs() {
  const types = ['quiz', 'lab', 'exam'];
  for (const type of types) {
    let data = JSON.parse(localStorage.getItem(type) || '[]');
    let changed = false;

    for (let itemIndex = 0; itemIndex < data.length; itemIndex++) {
      const item = data[itemIndex];
      if (!item || !Array.isArray(item.files)) continue;

      for (let i = 0; i < item.files.length; i++) {
        const f = item.files[i];
        if (!f) continue;

        // already a data URL
        if (typeof f.url === 'string' && f.url.startsWith('data:')) continue;

        // skip remote URLs
        if (typeof f.url === 'string' && /^https?:\/\//.test(f.url)) continue;

        // try to fetch local file and convert to data URL
        try {
          const resp = await fetch(f.url);
          if (!resp.ok) continue;
          const blob = await resp.blob();
          const dataUrl = await new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result);
            reader.onerror = rej;
            reader.readAsDataURL(blob);
          });

          item.files[i] = { name: f.name || f.url, url: dataUrl };
          changed = true;
        } catch (e) {
          // ignore errors (file might not exist or CORS); leave as-is
        }
      }
    }

    if (changed) {
      localStorage.setItem(type, JSON.stringify(data));
    }
  }
}

function initializeDefaultExamData() {
  let data = JSON.parse(localStorage.getItem('exam') || '[]');
  if (!data.length) {
    let sampleEntries = [
      {
        title: 'MIDTERM EXAM',
        files: [{ name: 'MIDTERM EXAM.jpeg', url: 'MIDTERM EXAM.jpeg' }],
        date: 'Imported sample upload'
      }
    ];    
    localStorage.setItem('exam', JSON.stringify(sampleEntries));
  }
}

function initializeDefaultLabData() {
  let data = JSON.parse(localStorage.getItem('lab') || '[]');
  if (!data.length) {
    let sampleEntries = [
      {
        title: 'OUTPUT LAB',
        files: [{ name: 'OUTPUT LAB.jpeg', url: 'OUTPUT LAB.jpeg' }],
        date: 'Imported sample upload'
      }
    ];
    localStorage.setItem('lab', JSON.stringify(sampleEntries));
  }
}

function initializeDefaultQuizData() {
  let data = JSON.parse(localStorage.getItem('quiz') || '[]');
  let updated = false;

  data = data.map(item => {
    if (item.title === 'FIALS QUIZ 2') {
      item.title = 'FINALS QUIZ 2';
      updated = true;
    }

    if (Array.isArray(item.files)) {
      item.files = item.files.map(file => {
        if (file && file.name === 'FIALS QUIZ 2.jpeg') {
          updated = true;
          return { ...file, name: 'FINALS QUIZ 2.jpeg', url: 'FINALS QUIZ 2.jpeg' };
        }
        return file;
      });
    }

    return item;
  });

  if (!data.length) {
    let sampleEntries = [
      {
        title: 'MIDTERM QUIZ 1',
        files: [{ name: 'MIDTERM QUIZ 1.jpeg', url: 'MIDTERM QUIZ 1.jpeg' }],
        date: 'Imported sample upload'
      },
      {
        title: 'MIDTERM QUIZ 2',
        files: [{ name: 'MIDTERM QUIZ 2.jpeg', url: 'MIDTERM QUIZ 2.jpeg' }],
        date: 'Imported sample upload'
      },
      {
        title: 'MIDTERM QUIZ 3',
        files: [{ name: 'MIDTERM QUIZ 3.jpeg', url: 'MIDTERM QUIZ 3.jpeg' }],
        date: 'Imported sample upload'
      },
      {
        title: 'LONG QUIZ MIDTERM',
        files: [{ name: 'LONG QUIZ MIDTERM.jpeg', url: 'LONG QUIZ MIDTERM.jpeg' }],
        date: 'Imported sample upload'
      },
      {
        title: 'LONG QUIZ FINALS',
        files: [{ name: 'LONG QUIZ FINALS.jpeg', url: 'LONG QUIZ FINALS.jpeg' }],
        date: 'Imported sample upload'
      },
      {
        title: 'FINALS QUIZ 1',
        files: [{ name: 'FINALS QUIZ 1.jpeg', url: 'FINALS QUIZ 1.jpeg' }],
        date: 'Imported sample upload'
      },
      {
        title: 'FINALS QUIZ 2',
        files: [{ name: 'FINALS QUIZ 2.jpeg', url: 'FINALS QUIZ 2.jpeg' }],
        date: 'Imported sample upload'
      }
    ];
    localStorage.setItem('quiz', JSON.stringify(sampleEntries));
    return;
  }

  if (updated) {
    localStorage.setItem('quiz', JSON.stringify(data));
  }
}

function renderUploadList(type, containerId) {
  let container = document.getElementById(containerId);
  if (!container) return;

  let data = JSON.parse(localStorage.getItem(type)) || [];
  data = sortUploads(type, data);
  container.innerHTML = '';

  if (!data.length) {
    container.innerHTML = '<p>No uploads yet.</p>';
    return;
  }

  const hideImages = ['quizList', 'labList', 'examList'].includes(containerId);

  data.forEach(item => {
    let card = document.createElement('div');
    card.className = 'upload-card';

    let title = document.createElement('h4');
    title.textContent = item.title || 'Untitled';
    card.appendChild(title);

    let date = document.createElement('small');
    date.textContent = item.date || '';
    card.appendChild(date);

    container.appendChild(card);
  });
}

function getPageType() {
  return document.body.dataset.uploadType || null;
}

// =====================
// INIT
// =====================
window.onload = async function () {
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
  }

  initializeDefaultExamData();
  initializeDefaultLabData();
  initializeDefaultQuizData();

  // ensure any local image files are converted to data URLs so previews render
  await ensureLocalFilesDataURLs();

  let pageType = getPageType();
  if (pageType) {
    displayData(pageType);
  }

  updateDashboard();
};