window.addEventListener('load', () => {
  const param = getParamFromUrl();
  const repo = getRepoName(param);
  const sortIdx = getSortIdx(param);

  initDT(sortIdx); // Initialize the DatatTable and window.columnNames variables
  addDarkmodeWidget();

  if (repo) {
    document.getElementById('q').value = repo;
    fetchData();
  }
});

document.getElementById('form').addEventListener('submit', e => {
  e.preventDefault();
  fetchData();
});

function addDarkmodeWidget() {
  new Darkmode( { label: '🌓' } ).showWidget();
}

function fetchData() {
  const repo = document.getElementById('q').value.replaceAll(' ','');
  const re = /[-_\w]+\/[-_.\w]+/;

  const param = getParamFromUrl();
  const urlRepo = getRepoName(param)

  if (!urlRepo || urlRepo !== repo) {
    window.history.pushState('', '', `#${repo}`);
  }

  if (re.test(repo)) {
    fetchAndShow(repo);
  } else {
    showMsg(
      'Invalid GitHub repository! Format is &lt;username&gt;/&lt;repo&gt;',
      'danger'
    );
  }
}

function updateDT(data) {
  // Remove any alerts, if any:
  if ($('.alert')) $('.alert').remove();

  // Format dataset and redraw DataTable. Use second index for key name
  const forks = [];
  for (let fork of data) {
    fork.repoLink = `<a href="https://github.com/${fork.full_name}">${fork.name}</a>`;
    fork.ownerName = `<img src="${fork.owner.avatar_url || 'https://avatars.githubusercontent.com/u/0?v=4'}&s=48" width="24" height="24" class="mr-2 rounded-circle" />${fork.owner ? `<a href="https://github.com/${fork.owner.login}">${fork.owner.login}</a>` : '<strike><em>Unknown</em></strike>'}`;
    forks.push(fork);
  }
  const dataSet = forks.map(fork =>
    window.columnNamesMap.map(colNM => fork[colNM[1]])
  );
  window.forkTable
    .clear()
    .rows.add(dataSet)
    .draw();
}

function initDT(sortIdx) {
  // Create ordered Object with column name and mapped display name
  window.columnNamesMap = [
    // ['Repository', 'full_name' ],
    ['Owner', 'ownerName'], // custom key
    ['Link', 'repoLink'], // custom key
    // ['Name', 'name'],
    ['Branch', 'default_branch'],
    ['Stars', 'stargazers_count'],
    ['Forks', 'forks'],
    ['Open Issues', 'open_issues_count'],
    ['Size', 'size'],
    ['Last Push', 'pushed_at'],
  ];

  const count = window.columnNamesMap.map(pair => pair[0]).length

  // 如果传参了排序列索引, 且索引有效则按索引, 否则按默认Stars排序
  if(sortIdx && !isNaN(sortIdx) && sortIdx < count){
    sortColumnIdx = sortIdx
  }else{
    sortColumnIdx = window.columnNamesMap
      .map(pair => pair[0])
      .indexOf('Stars');
  }

  // Use first index for readable column name
  // we use moment's fromNow() if we are rendering for `pushed_at`; better solution welcome
  window.forkTable = $('#forkTable').DataTable({
    columns: window.columnNamesMap.map(colNM => {
      return {
        title: colNM[0],
        width: colNM[1] === 'ownerName' ? "20%":"auto",
        render:
          colNM[1] === 'pushed_at'
            ? (data, type, _row) => {
                if (type === 'display') {
                  return moment(data).fromNow();
                }
                return data;
              }
            : null,
      };
    }),
    autoWidth: false,
    order: [[sortColumnIdx, 'desc']],
    // paging: false,
    searchBuilder:{
      // all options at default
    }
  });
  let table = window.forkTable;
  new $.fn.dataTable.SearchBuilder(table, {});
  table.searchBuilder.container().prependTo(table.table().container());
  table.columns.adjust().draw();
}

/**
 * 解析链接中的参数
 */
function parseParams(url) {
  const params = {};
  if (url.includes('?')) {
    const paramString = url.split("?")[1];
    if (paramString) {
      paramString.split("&").forEach(param => {
        const [key, value] = param.split("=");
        params[key] = decodeURIComponent(value);
      });
    }
  }
  return params;
}

/**
 * 从参数中获取排序列索引
 * @param {*} url
 * @returns
 */
function getSortIdx(url) {
  const params = parseParams(url);
  // 默认按Stars排序
  sort = 3;
  if ('sort' in params) {
    sort = params['sort']
  }
  return sort;
}

function getRepoName(str) {
  repo = str;
  if (str.includes('?')) {
    repo = str.split('?')[0]
  }
  repo = repo.replace('https://github.com/', '');
  repo = repo.replace('http://github.com/', '');
  repo = repo.replace(/\.git$/, '');
  return repo;
}

/**
 * 重试请求fetch
 * @param {*} url 请求链接
 * @param {*} retries 重试次数
 * @returns
 */
function retryFetch(url, retries = 3) {
  return fetch(url)
    .then(response => {
      if (response.ok) {
        return response;
      }
      if (retries > 0) {
        return retryFetch(url, retries - 1);
      }
      throw new Error('请求失败');
    });
}

function fetchAndShow(repo) {
  retryFetch(
    `https://api.github.com/repos/${repo}/forks?sort=stargazers&per_page=100`
  )
    .then(response => {
      if (!response.ok) throw Error(response.statusText);
      return response.json();
    })
    .then(data => {
      updateDT(data);
    })
    .catch(error => {
      const msg =
        error.toString().indexOf('Forbidden') >= 0
          ? 'Error: API Rate Limit Exceeded'
          : error;
      showMsg(`${msg}. Additional info in console`, 'danger');
      console.error(error);
    });
}

function showMsg(msg, type) {
  let alert_type = 'alert-info';

  if (type === 'danger') {
    alert_type = 'alert-danger';
  }

  document.getElementById('footer').innerHTML = '';

  document.getElementById('data-body').innerHTML = `
        <div class="alert ${alert_type} alert-dismissible fade show" role="alert">
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
            ${msg}
        </div>
    `;
}

function getParamFromUrl() {
  const urlRepo = location.hash && location.hash.slice(1);

  return urlRepo && decodeURIComponent(urlRepo);
}
