/**
 * Stack design system — light-first monochrome auth/marketing language.
 * Import tokens once (apps/web/src/index.css pulls in ./tokens.css),
 * then consume components from "@gossip/ui/stack".
 */
export { Button } from "./Button";
export type { StackButtonProps } from "./Button";
export { Input, PasswordInput, Field } from "./Input";
export type { StackInputProps } from "./Input";
export { Requirements } from "./Checklist";
export type { RequirementItem } from "./Checklist";
export { LabeledDivider } from "./Divider";
export { TextLink, textLinkClass } from "./TextLink";
export { Tooltip } from "./Tooltip";
export type { StackTooltipProps } from "./Tooltip";
export { EmptyState, IconTile } from "./EmptyState";
export { AuthLayout, DecorPanel, PanelCard, FooterBar, GossipMarkGraphic } from "./AuthLayout";
export { BrandLogo } from "./BrandLogo";
export type { BrandLogoProps } from "./BrandLogo";
export { GoogleGlyph } from "./icons";

/* AI chat flow (Gossip AI / workspace assistant) */
export {
  AiPromptComposer,
  AiChatBreadcrumb,
  AiUserBubble,
  AiAttachmentPreview,
  AiWorkingIndicator,
  AiAssistantBlock,
  AiProse,
  AiNextSteps,
  AiChatWatermark,
  AiChatHero,
  AiSuggestionGrid,
  AiSuggestionCard,
  AiOnboardingTips,
  AiChatShell,
  AiChatWelcomeLayout,
  AiChatThreadLayout,
  AiStepDots,
} from "./ai";
export type { AiPromptComposerProps, AiSkillOption } from "./ai";

/* Workspace shell (sidebar, lists, feed, Ask dock) */
export {
  Avatar,
  WorkspaceShell,
  WorkspacePaneHeader,
  WorkspaceContentHeader,
  PaneEmptyState,
  WorkspaceSidebarHeader,
  WorkspaceSwitcher,
  NavSection,
  NavItem,
  NavBadge,
  SidebarCard,
  TabPills,
  InboxRow,
  IssueRow,
  IssueTag,
  ListGroupHeader,
  StatusPill,
  PulseUpdateCard,
  StatusTransition,
  InlineReplyComposer,
  DraftUpdateCard,
  MetadataRow,
  AskDock,
  PaneIconButton,
  ContextMenu,
  IssueDetailLayout,
  DetailBreadcrumb,
  IssueDetailBody,
  IssueDetailTitle,
  SubIssueSection,
  SubIssueItem,
  AttributeChip,
  SubIssueComposer,
  ActivitySection,
  ActivityMessage,
  CommentComposer,
  PropertiesPanel,
  PropertySection,
  PropertyRow,
  StackModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  CreationCard,
  MilestonesBar,
  DatePickerPopover,
  DatePickerTrigger,
  SearchHeader,
  SearchFilterTabs,
  SearchResultRow,
  CustomizeSidebarModal,
  CustomizeSection,
  CustomizeRow,
  CustomizeSettingRow,
} from "./workspace";

/* Settings / admin (Linear-style workspace configuration) */
export {
  SettingsLayout,
  SettingsPageHeader,
  SettingsGroup,
  SettingsCard,
  SettingsRow,
  SettingsBackLink,
  SettingsNavSection,
  SettingsNavItem,
  Toggle,
  SelectControl,
  CopyField,
  IntegrationGrid,
  IntegrationCard,
  EmptySettingsBox,
  StatusListRow,
  SettingsListRow,
  DangerZone,
  DangerRow,
  ConfirmDestructiveModal,
  StackToast,
  WizardStepper,
  StatTile,
  StatGrid,
  PlanCard,
  WizardCard,
  WizardFooter,
} from "./settings";
