(() => {
  const navigation = document.querySelector('.docs-navigation');
  const wide = matchMedia('(min-width: 851px)');
  const sizeNavigation = () => {
    navigation.open = wide.matches;
  };
  sizeNavigation();
  wide.addEventListener('change', sizeNavigation);
  for (const button of document.querySelectorAll('.copy-code')) {
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(
          button.closest('.code-block').querySelector('code').textContent,
        );
        button.textContent = 'Copied';
      } catch {
        button.textContent = 'Select code to copy';
      }
      setTimeout(() => {
        button.textContent = 'Copy';
      }, 2200);
    });
  }
  const input = document.querySelector('#docs-search');
  const results = document.querySelector('#search-results');
  const status = document.querySelector('#search-status');
  let index;
  input.addEventListener('input', async () => {
    const query = input.value.trim().toLowerCase();
    results.replaceChildren();
    results.hidden = true;
    status.textContent = '';
    if (!query) return;
    try {
      index ??= fetch('/search-index.json').then((response) => {
        if (!response.ok) throw new Error('Search unavailable');
        return response.json();
      });
      const pages = await index;
      if (input.value.trim().toLowerCase() !== query) return;
      const words = query.split(/\s+/);
      const matches = pages
        .map((page) => {
          const title = page.title.toLowerCase();
          const text =
            `${title} ${page.description} ${page.text}`.toLowerCase();
          return {
            ...page,
            score: words.every((word) => text.includes(word))
              ? words.reduce(
                  (score, word) =>
                    score +
                    (title.includes(word)
                      ? 10
                      : page.description.toLowerCase().includes(word)
                        ? 5
                        : 1),
                  0,
                )
              : 0,
          };
        })
        .filter((page) => page.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);
      for (const page of matches) {
        const item = document.createElement('li'),
          link = document.createElement('a'),
          description = document.createElement('small');
        link.href = page.url;
        link.textContent = page.title;
        description.textContent = page.description;
        link.append(description);
        item.append(link);
        results.append(item);
      }
      if (!matches.length) {
        const item = document.createElement('li');
        item.textContent =
          'No matches. Try “contract”, “Vitest”, or “UNKNOWN”.';
        results.append(item);
      }
      results.hidden = false;
      status.textContent = `${matches.length} matching pages`;
    } catch {
      index = undefined;
      status.textContent =
        'Search is unavailable. Browse the documentation below.';
    }
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      results.hidden = true;
      status.textContent = '';
    }
    if (event.key === 'ArrowDown') {
      const first = results.querySelector('a');
      if (first) {
        event.preventDefault();
        first.focus();
      }
    }
  });
})();
