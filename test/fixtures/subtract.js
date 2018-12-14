const daysOfSun = 250,
      foods = ['tzatziki','feta','gyros'],
      islands = { inhabited: 170, total: 2000}

function getFactAboutCountry(fact) {
  switch(fact) {
    case 'food':
      return foods[1];
    default:
      return "These are fun facts!";
  }
}

