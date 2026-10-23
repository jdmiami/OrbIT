// The shop's "database" and a little helper shared by its pages.
window.BOOKS = [
  { id: 'harbour', title: 'A Harbour Town', author: 'M. Rocha', genre: 'travel', price: 14 },
  { id: 'lisbon', title: 'Lisbon in the Rain', author: 'J. Ferreira', genre: 'travel', price: 18 },
  { id: 'orbit', title: 'The Quiet Orbit', author: 'A. Lune', genre: 'fiction', price: 12 },
  { id: 'tides', title: 'Tides and Timetables', author: 'P. Okafor', genre: 'fiction', price: 16 },
];
window.param = (k) => new URLSearchParams(location.search).get(k) ?? '';
