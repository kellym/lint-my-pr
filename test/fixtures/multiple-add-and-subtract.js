const daysOfSun = 250,
      islands = { inhabited: 170, total: 2000},
      weddingEvents = ['plate-throwing','dancing' ];

function getFactAboutCountry(fact) {
  switch(fact) {
    case 'food':
      return foods[0];
    case 'islands':
      return islands.total;
    case 'wedding':
      return weddingEvents[0]
    default:
      return "These are fun facts!";
  }
}

