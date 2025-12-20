# Championnat

1. [ ] pouvoir configurer pour chaque qualif/course le controller/pilote/voiture
2. [ ] tous les pilotes ne roulent pas à chaque qualif/course, on peut avoir 10 pilotes et seulement 4 roulent à une
   qualif/course
   2.1. il faut pouvoir gérer ça dans l'UI (sélection pilote/voiture par controller)
   2.2. les pilotes non présents n'apparaissent pas dans le classement de la qualif/course
   2.3. dans le classement général, les pilotes non présents ne sont pas impactés, cela va permettre de creer des
   divisions (ex: division 1 avec pilotes A,B,C,D et division 2 avec pilotes E,F,G,H)


- Classement qualifications
    - le classement se fait en fonction du meilleur temps au tour de toutes les qualifications de chaque pilote
- Classement courses
    - le classement se fait en fonction du nombre de tours total terminés puis du temps total de toutes les courses de
      chaque pilote

- Classement qualifications (variant)
    - Cumul des meilleurs temps au tour de chaque qualification de chaque pilote

- Classement général
    - on a un onglet qualifications et un onglet courses
    - pour chaque onglet, on affiche le classement général correspondant.

# Qualifications

- pour une qualif de X minutes:
    - le pilote peut rouler autant de tours qu'il veut pendant les X minutes
    - le classement se fait en fonction du meilleur temps au tour
    - une fois les X minutes passées, la session se termine pour tout le monde et on coupe le CU (bouton start + led 1)
- pour une qualif de X tours:
    - la qualif se termine quand le premier a fait X tours
    - les autres peuvent continuer à rouler pour terminer leur X tours
    - le classement se fait en fonction du meilleur temps au tour
    - une fois tout le monde a terminé ses X tours, la session se termine pour tout le monde et on coupe le CU (bouton
      start + led 1)

# Courses

- pour une course de X tours:
    - la course se termine quand le premier a fait X tours
    - les autres peuvent continuer à rouler pour terminer leur tour actuel
    - le classement se fait en fonction du nombre de tours terminés puis du temps total
    - DNF s'il n'a pas terminé sont tour actuel au bout de 30s après le premier
    - une fois les 30s passées, la session se termine pour tout le monde et on coupe le CU (bouton start + led 1)
- pour une course de durée X minutes:
    - la course se termine quand le temps est écoulé et que tout le monde a terminé son tour actuel
    - le classement se fait en fonction du nombre de tours terminés puis du temps total
    - DNF s'il n'a pas terminé sont tour actuel au bout de 30s après la fin du temps
    - une fois les 30s passées, la session se termine pour tout le monde et on coupe le CU (bouton start + led 1)

