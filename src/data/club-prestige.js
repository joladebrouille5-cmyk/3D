// Hiérarchie interne des championnats (écart de niveau moyen, en points de note 0-1).
// Sans elle, tous les clubs d'une même division auraient la même force (le PSG = le promu).
// Valeurs de jeu, indicatives : à ajuster librement.
export const CLUB_PRESTIGE = {
  // Ligue 1
  'paris-saint-germain': 0.065, 'olympique-de-marseille': 0.035, 'as-monaco': 0.033, 'losc-lille': 0.03,
  'olympique-lyonnais': 0.03, 'rc-lens': 0.02, 'ogc-nice': 0.015, 'stade-rennais': 0.018, 'rc-strasbourg-alsace': 0.012,
  'stade-brestois': 0.0, 'toulouse-fc': -0.002, 'fc-lorient': -0.012, 'aj-auxerre': -0.014, 'angers-sco': -0.016,
  'paris-fc': -0.008, 'le-havre-ac': -0.02, 'le-mans-fc': -0.026, 'estac-troyes': -0.022,
  // Ligue 2
  'as-saint-etienne': 0.025, 'fc-nantes': 0.025, 'montpellier-hsc': 0.02, 'stade-de-reims': 0.02, 'fc-metz': 0.018,
  'clermont-foot': 0.005, 'en-avant-guingamp': 0.0, 'fc-annecy': -0.005, 'pau-fc': -0.005, 'red-star-fc': 0.0,
  'dijon-fco': -0.006, 'as-nancy-lorraine': -0.008, 'fc-sochaux-montbeliard': 0.0, 'grenoble-foot': -0.004,
  'rodez-af': -0.01, 'stade-lavallois': -0.008, 'us-boulogne': -0.015, 'usl-dunkerque': -0.012,
  // National
  'sc-bastia': 0.012, 'sm-caen': 0.012, 'amiens-sc': 0.01, 'valenciennes-fc': 0.008, 'fc-rouen': 0.004,
};

// Centres de formation réputés (bonus de qualité 0-1)
export const ACADEMY_BONUS = {
  'paris-saint-germain': 0.05, 'olympique-lyonnais': 0.05, 'stade-rennais': 0.05, 'as-monaco': 0.04, 'losc-lille': 0.03,
  'fc-nantes': 0.04, 'fc-sochaux-montbeliard': 0.04, 'as-saint-etienne': 0.03, 'montpellier-hsc': 0.03, 'fc-metz': 0.02,
  'rc-lens': 0.03, 'aj-auxerre': 0.03, 'toulouse-fc': 0.02, 'sm-caen': 0.02, 'olympique-de-marseille': 0.02,
};
