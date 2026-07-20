// Icon set — Tabler icons (@tabler/icons-react), matching the Figma design system.
// The design uses the FILLED variant, so we alias the *Filled icons to the names
// the app imports. Chevrons and refresh have no (usable) filled variant, so they
// stay outline — the stepper up/down pair is kept outline together for consistency.
export {
  IconXFilled as XIcon,
  IconCurrentLocationFilled as IconCurrentLocation,
  IconClickFilled as IconClick,
  IconPencilFilled as IconPencil,
  IconCheckFilled as IconCheck,
  IconDownloadFilled as IconDownload,
  IconCaretRightFilled as IconCaretRight, // breadcrumb separator (header)
  IconChevronLeft,
  IconChevronUp,
  IconChevronDown,
  IconRefresh,
  IconGripVertical,
  IconMessageFilled as IconMessage,
  // Property-row lead icons (Tabler, filled variant), chosen per property.
  IconArrowAutofitWidthFilled,
  IconContainerFilled,
  IconPlayerRecordFilled,
  IconDropletHalfFilled,
  IconPhotoFilled,
  IconAspectRatioFilled,
  IconMapPinFilled,
  IconEyeglass2Filled,
  IconBoxMultipleFilled,
  IconFiltersFilled,
  IconVersionsFilled,
  IconSquareFilled,
  IconLinkFilled,
  // Corner-radius link toggle. No filled variant exists for unlink, so the pair
  // is kept outline together rather than mismatching weights across one control.
  IconLink,
  IconUnlink,
} from '@tabler/icons-react';
