const daysOfSun = 250,
      islands = { inhabited: 170, total: 2000},
      weddingEvents = ['plate-throwing','dancing' ];

function getFactAboutCountry(fact) {
  switch(fact) {
    case 'food':
      return foods[1];
    case 'islands':
      return islands.inhabited
    default:
      return "These are fun facts!";
  }
}

