export const POWER_CATALOG = [
  { id: "shield", label: "Escudo violeta", description: "Cancela un castigo auxiliar dirigido a ti.", timing: "Antes de revelar Castigo", duration: "Una activación", effect: "cancel_punishment", cancel: "Se consume al cancelar un Castigo." },
  { id: "redraw", label: "Reescritura", description: "Cambia la carta principal o la auxiliar más reciente por otra del mismo mazo.", timing: "Con carta sin resolver", duration: "Una activación", effect: "replace_card", cancel: "Se consume si la carta se reemplaza." },
  { id: "pass", label: "Pase libre", description: "Cierra tu desafío actual sin penalización.", timing: "Durante tu turno activo", duration: "Una activación", effect: "resolve_alternative", cancel: "Se consume al elegir la alternativa." },
];
