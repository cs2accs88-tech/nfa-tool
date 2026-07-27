export function createFilterPanel(onChange) {
  const panel = document.createElement('div');
  panel.className = 'filter-panel';

  const fields = [
    { label: 'Prime status', type: 'select', name: 'primeStatus', options: ['Any', 'Prime', 'Standard'] },
    { label: 'VAC status', type: 'select', name: 'vacStatus', options: ['Any', 'Clean', 'Banned'] },
    { label: 'Rank min', type: 'number', name: 'rankMin' },
    { label: 'Rank max', type: 'number', name: 'rankMax' },
    { label: 'Inventory min', type: 'number', name: 'inventoryMin' },
    { label: 'Inventory max', type: 'number', name: 'inventoryMax' }
  ];

  fields.forEach((field) => {
    const label = document.createElement('label');
    label.innerHTML = `<span>${field.label}</span>`;

    let input;
    if (field.type === 'select') {
      input = document.createElement('select');
      field.options.forEach((optionValue) => {
        const option = document.createElement('option');
        option.value = optionValue.toLowerCase();
        option.textContent = optionValue;
        input.appendChild(option);
      });
    } else {
      input = document.createElement('input');
      input.type = field.type;
      input.placeholder = field.label;
    }

    input.name = field.name;
    input.addEventListener('change', onChange);
    label.appendChild(input);
    panel.appendChild(label);
  });

  return panel;
}
