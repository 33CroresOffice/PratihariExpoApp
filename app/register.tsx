import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Switch,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { sendNotification } from '@/lib/pushNotifications';
import { ChevronRight, ChevronLeft, Check, Camera, Plus, Trash2, Phone, MessageCircle, Facebook, Twitter, Instagram, Linkedin, Youtube, Briefcase, Info, Mail, User, MapPin, Heart, Calendar, CreditCard, Search, X, Link, Upload, Lock, CircleAlert as AlertCircle } from 'lucide-react-native';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const T = {
  // Brand
  primary: '#D4642A',
  primaryLight: '#F08050',
  primaryBg: '#FEF3EE',
  primaryBorder: '#F4C5A8',
  gold: '#B8860B',
  // Neutrals – dark
  ink: '#111318',
  inkSecondary: '#3D4451',
  inkTertiary: '#6B7280',
  inkQuaternary: '#9CA3AF',
  // Surfaces
  canvas: '#F4F5F7',
  surface: '#FFFFFF',
  surfaceHover: '#F9FAFB',
  // Borders
  line: '#E5E7EB',
  lineMid: '#D1D5DB',
  // States
  red: '#DC2626',
  redBg: '#FEF2F2',
  redLine: '#FECACA',
  green: '#16A34A',
  greenBg: '#F0FDF4',
  greenLine: '#86EFAC',
  // Step
  stepDone: '#D4642A',
  stepActive: '#D4642A',
  stepTodo: '#E5E7EB',
};

const STEPS = ['Personal', 'Contact & IDs', 'Seba', 'Family', 'Address', 'Occupation', 'Social'];

const ID_TYPES = ['Aadhar Card', 'PAN Card', 'Voter ID', 'Passport', 'Driving Licence'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChildEntry {
  child_name: string;
  date_of_birth: string;
  gender: string;
  marital_status: string;
  photo_url: string;
}

interface OccupationEntry {
  occupation: string;
  extra_curriculum_activity: string;
}

interface IdDocEntry {
  id_type: string;
  photo_url: string;
}

interface FormData {
  whatsapp_same_as_primary: boolean;
  whatsapp_number: string;
  email: string;
  primary_phone: string;
  extra_phones: string[];
  first_name: string;
  middle_name: string;
  last_name: string;
  alias_name: string;
  full_name: string;
  date_of_birth: string;
  gender: string;
  photo_url: string;
  is_bhagari: boolean;
  is_baristha_bhai_pua: boolean;
  blood_group: string;
  health_card_no: string;
  health_card_photo_url: string;
  father_name: string;
  father_sebayat_id: string;
  mother_name: string;
  marital_status: string;
  spouse_name: string;
  spouse_photo_url: string;
  spouse_father_name: string;
  spouse_mother_name: string;
  spouse_father_photo_url: string;
  spouse_mother_photo_url: string;
  children: ChildEntry[];
  current_sahi: string;
  current_landmark: string;
  current_post_office: string;
  current_police_station: string;
  current_pincode: string;
  current_district: string;
  current_state: string;
  current_country: string;
  current_address_text: string;
  is_permanent_different: boolean;
  permanent_sahi: string;
  permanent_landmark: string;
  permanent_post_office: string;
  permanent_police_station: string;
  permanent_pincode: string;
  permanent_district: string;
  permanent_state: string;
  permanent_country: string;
  permanent_address_text: string;
  occupations: OccupationEntry[];
  id_documents: IdDocEntry[];
  social_facebook: string;
  social_twitter: string;
  social_instagram: string;
  social_linkedin: string;
  social_youtube: string;
  bansa_name: string;
  palia_number: string;
  seba_name: string;
  joining_date_exact: boolean;
  joining_year: string;
  joining_date: string;
}

type ScalarFormKey = {
  [K in keyof FormData]: FormData[K] extends string ? K : never;
}[keyof FormData];

const EMPTY: FormData = {
  whatsapp_same_as_primary: false,
  whatsapp_number: '',
  email: '',
  primary_phone: '',
  extra_phones: [],
  first_name: '',
  middle_name: '',
  last_name: '',
  alias_name: '',
  full_name: '',
  date_of_birth: '',
  gender: '',
  photo_url: '',
  is_bhagari: false,
  is_baristha_bhai_pua: false,
  blood_group: '',
  health_card_no: '',
  health_card_photo_url: '',
  father_name: '',
  father_sebayat_id: '',
  mother_name: '',
  marital_status: '',
  spouse_name: '',
  spouse_photo_url: '',
  spouse_father_name: '',
  spouse_mother_name: '',
  spouse_father_photo_url: '',
  spouse_mother_photo_url: '',
  children: [],
  current_sahi: '',
  current_landmark: '',
  current_post_office: '',
  current_police_station: '',
  current_pincode: '',
  current_district: '',
  current_state: '',
  current_country: 'India',
  current_address_text: '',
  is_permanent_different: false,
  permanent_sahi: '',
  permanent_landmark: '',
  permanent_post_office: '',
  permanent_police_station: '',
  permanent_pincode: '',
  permanent_district: 'Puri',
  permanent_state: 'Odisha',
  permanent_country: 'India',
  permanent_address_text: '',
  occupations: [{ occupation: '', extra_curriculum_activity: '' }],
  id_documents: [{ id_type: '', photo_url: '' }],
  social_facebook: '',
  social_twitter: '',
  social_instagram: '',
  social_linkedin: '',
  social_youtube: '',
  bansa_name: '',
  palia_number: '',
  seba_name: '',
  joining_date_exact: true,
  joining_year: '',
  joining_date: '',
};

// ─── Primitive components ─────────────────────────────────────────────────────

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text style={p.label}>
      {text}
      {required ? <Text style={p.labelReq}> *</Text> : null}
    </Text>
  );
}

function ErrMsg({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <Text style={p.errMsg}>{msg}</Text>;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  error,
  kbd = 'default',
  multiline,
  maxLen,
  noCap,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  kbd?: 'default' | 'number-pad' | 'numeric' | 'url' | 'phone-pad';
  multiline?: boolean;
  maxLen?: number;
  noCap?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={p.fieldWrap}>
      <Label text={label} required={required} />
      <TextInput
        style={[
          p.input,
          multiline && p.inputMulti,
          focused && p.inputFocused,
          !!error && p.inputErr,
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? ''}
        placeholderTextColor={T.inkQuaternary}
        keyboardType={kbd}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        maxLength={maxLen}
        autoCapitalize={noCap ? 'none' : 'words'}
      />
      <ErrMsg msg={error} />
    </View>
  );
}

function PhoneField({
  label,
  value,
  onChange,
  placeholder,
  required,
  error,
  IconNode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  IconNode: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const valid = /^\d{10}$/.test(value.trim());
  return (
    <View style={p.fieldWrap}>
      <Label text={label} required={required} />
      <View style={[p.iconInput, focused && p.iconInputFocused, !!error && p.iconInputErr]}>
        <View style={p.iconSlot}>{IconNode}</View>
        <View style={p.iconDivider} />
        <TextInput
          style={p.iconInputText}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? '10-digit number'}
          placeholderTextColor={T.inkQuaternary}
          keyboardType="phone-pad"
          maxLength={10}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {valid && (
          <View style={p.validMark}>
            <Check color={T.green} size={12} strokeWidth={3} />
          </View>
        )}
      </View>
      <ErrMsg msg={error} />
    </View>
  );
}

function Chips({
  label,
  value,
  options,
  onSelect,
  required,
  error,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  required?: boolean;
  error?: string;
}) {
  return (
    <View style={p.fieldWrap}>
      <Label text={label} required={required} />
      <View style={p.chipsRow}>
        {options.map((o) => {
          const sel = value === o;
          return (
            <TouchableOpacity
              key={o}
              style={[p.chip, sel && p.chipSel]}
              onPress={() => onSelect(o)}
              activeOpacity={0.75}
            >
              {sel && <Check color={T.primary} size={11} strokeWidth={3} style={{ marginRight: 4 }} />}
              <Text style={[p.chipTxt, sel && p.chipTxtSel]}>{o}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <ErrMsg msg={error} />
    </View>
  );
}

function SelectField({
  label,
  value,
  options,
  placeholder,
  onChange,
  required,
  error,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={p.fieldWrap}>
      <Label text={label} required={required} />
      <TouchableOpacity
        style={[p.input, sel.trigger, !!error && p.inputErr]}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
      >
        <Text style={value ? sel.triggerTxt : sel.triggerPh}>{value || placeholder || 'Select…'}</Text>
        <ChevronRight color={T.inkQuaternary} size={16} style={{ transform: [{ rotate: '90deg' }] }} />
      </TouchableOpacity>
      <ErrMsg msg={error} />
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={sel.overlay}>
          <View style={sel.sheet}>
            <View style={sel.sheetHead}>
              <Text style={sel.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} style={sel.sheetClose}>
                <X color={T.inkSecondary} size={20} />
              </TouchableOpacity>
            </View>
            <ScrollView style={sel.list} bounces={false}>
              {options.map((opt) => {
                const chosen = value === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[sel.item, chosen && sel.itemSel]}
                    onPress={() => { onChange(opt); setOpen(false); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[sel.itemTxt, chosen && sel.itemTxtSel]}>{opt}</Text>
                    {chosen && <Check color={T.primary} size={16} strokeWidth={2.5} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const sel = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerTxt: { fontSize: 15, fontFamily: 'Poppins_400Regular', color: T.ink },
  triggerPh: { fontSize: 15, fontFamily: 'Poppins_400Regular', color: T.inkQuaternary },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  sheetTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: T.ink },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingVertical: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  itemSel: { backgroundColor: T.primaryBg },
  itemTxt: { fontSize: 15, fontFamily: 'Poppins_400Regular', color: T.inkSecondary },
  itemTxtSel: { fontFamily: 'Poppins_600SemiBold', color: T.primary },
});

function Divider({ title }: { title: string }) {
  return (
    <View style={p.divider}>
      <Text style={p.dividerTxt}>{title}</Text>
    </View>
  );
}

function JoiningPickerModal({
  visible, exact, date, year, onChangeFull, onChangeYear, onClose,
}: {
  visible: boolean; exact: boolean;
  date: string; year: string;
  onChangeFull: (d: string) => void;
  onChangeYear: (y: string) => void;
  onClose: () => void;
}) {
  const parts = date.split('/');
  const [d, setD] = useState(parts[0] || '');
  const [m, setM] = useState(parts[1] || '');
  const [y, setY] = useState(parts[2] || year || '');

  useEffect(() => {
    if (visible) {
      const p2 = date.split('/');
      setD(p2[0] || ''); setM(p2[1] || ''); setY(p2[2] || year || '');
    }
  }, [visible]);

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  const months = [
    { label: 'Jan', val: '01' }, { label: 'Feb', val: '02' }, { label: 'Mar', val: '03' },
    { label: 'Apr', val: '04' }, { label: 'May', val: '05' }, { label: 'Jun', val: '06' },
    { label: 'Jul', val: '07' }, { label: 'Aug', val: '08' }, { label: 'Sep', val: '09' },
    { label: 'Oct', val: '10' }, { label: 'Nov', val: '11' }, { label: 'Dec', val: '12' },
  ];
  const curYear = new Date().getFullYear();
  const years = Array.from({ length: 80 }, (_, i) => String(curYear - i));

  const latestY = useRef(y);
  useEffect(() => { latestY.current = y; }, [y]);

  function handleDone() {
    if (exact) {
      onChangeFull(`${d}/${m}/${latestY.current}`);
    } else {
      onChangeYear(latestY.current);
    }
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sel.overlay}>
        <View style={[sel.sheet, { maxHeight: exact ? '55%' : '45%' }]}>
          <View style={sel.sheetHead}>
            <Text style={sel.sheetTitle}>{exact ? 'Date of Joining' : 'Year of Joining'}</Text>
            <TouchableOpacity onPress={onClose} style={sel.sheetClose}>
              <X color={T.inkSecondary} size={20} />
            </TouchableOpacity>
          </View>
          <View style={jpm.pickerWrap}>
            {exact ? (
              <>
                {/* Day */}
                <View style={jpm.seg}>
                  <Text style={jpm.segHdr}>Day</Text>
                  <ScrollView style={jpm.list} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                    {days.map((day) => (
                      <TouchableOpacity key={day} style={[jpm.item, d === day && jpm.itemSel]} onPress={() => setD(day)} activeOpacity={0.7}>
                        <Text style={[jpm.itemTxt, d === day && jpm.itemTxtSel]}>{day}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={jpm.sep} />
                {/* Month */}
                <View style={[jpm.seg, { flex: 1.3 }]}>
                  <Text style={jpm.segHdr}>Month</Text>
                  <ScrollView style={jpm.list} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                    {months.map(({ label, val }) => (
                      <TouchableOpacity key={val} style={[jpm.item, m === val && jpm.itemSel]} onPress={() => setM(val)} activeOpacity={0.7}>
                        <Text style={[jpm.itemTxt, m === val && jpm.itemTxtSel]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={jpm.sep} />
              </>
            ) : null}
            {/* Year */}
            <View style={[jpm.seg, { flex: exact ? 1.5 : 1 }]}>
              <Text style={jpm.segHdr}>Year</Text>
              <ScrollView style={jpm.list} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {years.map((yr) => (
                  <TouchableOpacity
                    key={yr}
                    style={[jpm.item, y === yr && jpm.itemSel]}
                    onPress={() => {
                      setY(yr);
                      if (!exact) {
                        onChangeYear(yr);
                        onClose();
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[jpm.itemTxt, y === yr && jpm.itemTxtSel]}>{yr}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          <View style={jpm.footer}>
            <TouchableOpacity style={jpm.doneBtn} onPress={handleDone} activeOpacity={0.8}>
              <Text style={jpm.doneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const jpm = StyleSheet.create({
  pickerWrap: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8 },
  seg: { flex: 1, alignItems: 'center' },
  segHdr: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: T.inkTertiary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  sep: { width: 1, backgroundColor: T.line, marginHorizontal: 4 },
  list: { height: 170, width: '100%' },
  item: { paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  itemSel: { backgroundColor: T.primary },
  itemTxt: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: T.ink },
  itemTxtSel: { color: '#fff', fontFamily: 'Poppins_700Bold' },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: T.line },
  doneBtn: { backgroundColor: T.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  doneTxt: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: '#fff' },
});

function Notice({ text, variant = 'info' }: { text: string; variant?: 'info' | 'warn' }) {
  const bg = variant === 'warn' ? '#FFFBEB' : T.primaryBg;
  const border = variant === 'warn' ? '#FDE68A' : T.primaryBorder;
  const color = variant === 'warn' ? '#92400E' : T.primary;
  return (
    <View style={[p.notice, { backgroundColor: bg, borderColor: border }]}>
      <Info color={color} size={15} />
      <Text style={[p.noticeTxt, { color: variant === 'warn' ? '#78350F' : T.inkSecondary }]}>
        {text}
      </Text>
    </View>
  );
}

// shared primitive styles
const p = StyleSheet.create({
  fieldWrap: { marginBottom: 20 },
  label: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    color: T.inkTertiary,
    marginBottom: 7,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  labelReq: { color: T.red },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: T.ink,
    backgroundColor: T.surface,
  },
  inputMulti: {
    height: 96,
    paddingTop: 12,
    paddingBottom: 12,
  },
  inputFocused: { borderColor: T.primary, backgroundColor: T.primaryBg },
  inputErr: { borderColor: T.red, backgroundColor: T.redBg },
  errMsg: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: T.red,
    marginTop: 5,
  },
  // icon input (phone fields)
  iconInput: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 10,
    backgroundColor: T.surface,
    overflow: 'hidden',
  },
  iconInputFocused: { borderColor: T.primary, backgroundColor: T.primaryBg },
  iconInputErr: { borderColor: T.red, backgroundColor: T.redBg },
  iconSlot: {
    width: 48,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDivider: { width: 1, height: 24, backgroundColor: T.line },
  iconInputText: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: T.ink,
  },
  validMark: {
    marginRight: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: T.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // chips
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: T.line,
    backgroundColor: T.surface,
  },
  chipSel: { borderColor: T.primary, backgroundColor: T.primaryBg },
  chipTxt: {
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    color: T.inkTertiary,
  },
  chipTxtSel: { color: T.primary, fontFamily: 'Poppins_600SemiBold' },
  // divider
  divider: {
    marginTop: 8,
    marginBottom: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  dividerTxt: {
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
    color: T.ink,
  },
  // notice
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 24,
  },
  noticeTxt: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 20,
  },
});

// ─── Seba types ──────────────────────────────────────────────────────────────

interface SebaCategory {
  id: string;
  name: string;
  name_or: string | null;
  beddha_count: number;
}

// { [categoryId]: { [beddhaNumber]: 'hereditary' | 'nijog_assigned' } }
type BeddhaMap = Record<string, Record<number, string>>;

// { [categoryId]: Set of selected beddha numbers }
type SebaSelections = Record<string, number[]>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isOdia = language === 'or';
  const router = useRouter();
  const params = useLocalSearchParams<{ admin_remarks?: string; change_section?: string }>();
  const DRAFT_KEY = 'registration_draft_v1';

  function saveDraft(f: FormData, s: number) {
    if (typeof window === 'undefined') return;
    try { window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form: f, step: s, ts: Date.now() })); } catch {}
  }

  function loadDraft(): { form: FormData; step: number } | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  function clearDraft() {
    if (typeof window === 'undefined') return;
    try { window.sessionStorage.removeItem(DRAFT_KEY); } catch {}
  }

  const [step, setStep] = useState(() => loadDraft()?.step ?? 0);
  const [form, setForm] = useState<FormData>(() => loadDraft()?.form ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dobOpen, setDobOpen] = useState(false);
  const [joiningOpen, setJoiningOpen] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [existingStatus, setExistingStatus] = useState('');
  const [adminRemarks, setAdminRemarks] = useState('');
  const [sebayatRowId, setSebayatRowId] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showSebaConfirmModal, setShowSebaConfirmModal] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Maps change_section value from DB to the STEPS index
  const SECTION_STEP: Record<string, number> = {
    personal: 0, contact: 1, documents: 1, seba: 2, family: 3, address: 4,
  };

  // Change-request mode: user can only edit the one locked step
  const isChangeRequest = existingStatus === 'changes_requested';
  const changeRequestSection = params.change_section || '';
  const changeRequestStep = changeRequestSection ? (SECTION_STEP[changeRequestSection] ?? step) : step;

  // Seba step state
  const HIDDEN_SEBAS = ['Singha Dwara', 'Dwara Ghara'];
  const [sebaCategories, setSebaCategories] = useState<SebaCategory[]>([]);
  const [sebaBeddhaMap, setSebaBeddhaMap] = useState<BeddhaMap>({});
  const [sebaSelections, setSebaSelections] = useState<SebaSelections>({});
  const [loadingSeba, setLoadingSeba] = useState(false);
  const [sebaExpanded, setSebaExpanded] = useState<Record<string, boolean>>({});

  async function pickAndUpload(
    storageKey: string,
    onSuccess: (url: string) => void,
  ) {
    if (Platform.OS !== 'web') return;
    return new Promise<void>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) { resolve(); return; }
        setUploadingKey(storageKey);
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${user!.id}/${storageKey}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage
          .from('profile-photos')
          .upload(path, file, { upsert: true, contentType: file.type });
        if (!error) {
          const { data } = supabase.storage.from('profile-photos').getPublicUrl(path);
          onSuccess(data.publicUrl);
        }
        setUploadingKey(null);
        resolve();
      };
      input.click();
    });
  }

  useEffect(() => {
    async function load() {
      if (!user) return;
      const draft = loadDraft();
      // Look up sebayat by auth_user_id (works for both self-registered and admin-pre-created profiles)
      const { data: s } = await supabase.from('sebayats').select('*').eq('auth_user_id', user.id).maybeSingle();
      const rowId = s?.id ?? null;
      if (rowId) setSebayatRowId(rowId);
      const [{ data: phones }, { data: kids }, { data: occs }, { data: idDocs }] = rowId
        ? await Promise.all([
            supabase.from('phone_numbers').select('*').eq('sebayat_id', rowId),
            supabase.from('children').select('*').eq('sebayat_id', rowId),
            supabase.from('occupations').select('*').eq('sebayat_id', rowId),
            supabase.from('identity_documents').select('*').eq('sebayat_id', rowId),
          ])
        : [{ data: null }, { data: null }, { data: null }, { data: null }];
      // Resolve the user's phone from all available sources
      const resolvedPhone = (
        user?.user_metadata?.phone ||
        (user as any)?.phone ||
        s?.primary_phone ||
        s?.phone ||
        ''
      ).replace(/^91/, '').replace(/^\+91/, '').replace(/\D/g, '').slice(-10);

      if (s) {
        setExistingStatus(s.profile_status || '');
        if (s.profile_status === 'changes_requested' || s.profile_status === 'rejected') {
          // Prefer remarks/section from URL params (navigated from home screen CTA)
          const remarksToShow = params.admin_remarks || s.admin_remarks || '';
          const sectionToUse = params.change_section || s.change_section || '';
          setAdminRemarks(remarksToShow);
          // Only jump to the targeted step if there is no existing draft
          if (!draft) {
            const targetStep = sectionToUse ? (SECTION_STEP[sectionToUse] ?? 0) : 0;
            setStep(targetStep);
          }
        }
        // Restore from draft if one exists (user navigated away and came back)
        if (draft) {
          // Still ensure phone is up to date even in draft restores
          if (resolvedPhone) setForm((prev) => ({ ...prev, primary_phone: prev.primary_phone || resolvedPhone }));
          setLoadingExisting(false);
          return;
        }
        setForm({
          whatsapp_same_as_primary: false,
          whatsapp_number: s.whatsapp_number || '',
          email: s.email || '',
          primary_phone: resolvedPhone || s.primary_phone || '',
          extra_phones: phones ? phones.map((p: any) => p.phone_number) : [],
          first_name: s.first_name || '',
          middle_name: s.middle_name || '',
          last_name: s.last_name || '',
          alias_name: s.alias_name || '',
          full_name: s.full_name || '',
          date_of_birth: (() => {
            const dob = s.date_of_birth || '';
            // Convert ISO YYYY-MM-DD from DB → DD/MM/YYYY for internal picker
            const m = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            return m ? `${m[3]}/${m[2]}/${m[1]}` : dob;
          })(),
          gender: s.gender || '',
          photo_url: s.photo_url || '',
          is_bhagari: s.is_bhagari || false,
          is_baristha_bhai_pua: s.is_baristha_bhai_pua || false,
          blood_group: s.blood_group || '',
          health_card_no: s.health_card_no || '',
          health_card_photo_url: s.health_card_photo_url || '',
          father_name: s.father_name || '',
          father_sebayat_id: s.father_sebayat_id || '',
          mother_name: s.mother_name || '',
          marital_status: s.marital_status || '',
          spouse_name: s.spouse_name || '',
          spouse_photo_url: s.spouse_photo_url || '',
          spouse_father_name: s.spouse_father_name || '',
          spouse_mother_name: s.spouse_mother_name || '',
          spouse_father_photo_url: s.spouse_father_photo_url || '',
          spouse_mother_photo_url: s.spouse_mother_photo_url || '',
          children: kids ? kids.map((c: any) => ({
            child_name: c.child_name || '',
            date_of_birth: c.date_of_birth || '',
            gender: c.gender || '',
            marital_status: c.marital_status || '',
            photo_url: c.photo_url || '',
          })) : [],
          current_sahi: s.current_sahi || '',
          current_landmark: s.current_landmark || '',
          current_post_office: s.current_post_office || '',
          current_police_station: s.current_police_station || '',
          current_pincode: s.current_pincode || '',
          current_district: s.current_district || '',
          current_state: s.current_state || '',
          current_country: s.current_country || 'India',
          current_address_text: s.current_address_text || '',
          is_permanent_different: s.is_permanent_different || false,
          permanent_sahi: s.permanent_sahi || '',
          permanent_landmark: s.permanent_landmark || '',
          permanent_post_office: s.permanent_post_office || '',
          permanent_police_station: s.permanent_police_station || '',
          permanent_pincode: s.permanent_pincode || '',
          permanent_district: s.permanent_district || 'Puri',
          permanent_state: s.permanent_state || 'Odisha',
          permanent_country: s.permanent_country || 'India',
          permanent_address_text: s.permanent_address_text || '',
          occupations: occs && occs.length > 0
            ? occs.map((o: any) => ({ occupation: o.occupation || '', extra_curriculum_activity: o.extra_curriculum_activity || '' }))
            : [{ occupation: '', extra_curriculum_activity: '' }],
          id_documents: idDocs && idDocs.length > 0
            ? idDocs.map((d: any) => ({ id_type: d.id_type || '', photo_url: d.photo_url || '' }))
            : [{ id_type: '', photo_url: '' }],
          social_facebook: s.social_facebook || '',
          social_twitter: s.social_twitter || '',
          social_instagram: s.social_instagram || '',
          social_linkedin: s.social_linkedin || '',
          social_youtube: s.social_youtube || '',
          bansa_name: s.bansa_name || '',
          palia_number: s.palia_number || '',
          seba_name: s.seba_name || '',
          joining_date_exact: s.joining_date_exact ?? true,
          joining_year: s.joining_year || '',
          joining_date: s.joining_date || '',
        });
      } else {
        // New user — pre-fill primary phone from auth
        if (resolvedPhone) setForm((prev) => ({ ...prev, primary_phone: resolvedPhone }));
      }
      setLoadingExisting(false);
    }
    load();
  }, [user]);

  // Auto-save draft to sessionStorage whenever form or step changes
  useEffect(() => {
    if (!loadingExisting) saveDraft(form, step);
  }, [form, step, loadingExisting]);

  // Load seba categories + beddha map + existing selections when reaching step 6
  useEffect(() => {
    if (step !== 2) return;
    if (sebaCategories.length > 0) return; // already loaded
    async function loadSeba() {
      setLoadingSeba(true);
      const [{ data: cats }, { data: beddhas }, { data: existing }] = await Promise.all([
        supabase
          .from('seba_categories')
          .select('id, name, name_or, beddha_count')
          .eq('is_active', true)
          .eq('category_type', 'seba')
          .order('sort_order')
          .order('name'),
        supabase.from('seba_beddhas').select('seba_category_id, beddha_number, beddha_type'),
        sebayatRowId
          ? supabase.from('sebayat_seba_selections').select('seba_category_id, beddha_number').eq('sebayat_id', sebayatRowId)
          : Promise.resolve({ data: [] }),
      ]);
      if (cats) setSebaCategories(cats);
      if (beddhas) {
        const map: BeddhaMap = {};
        for (const r of beddhas) {
          if (!map[r.seba_category_id]) map[r.seba_category_id] = {};
          map[r.seba_category_id][r.beddha_number] = r.beddha_type;
        }
        setSebaBeddhaMap(map);
      }
      if (existing && existing.length > 0) {
        const sel: SebaSelections = {};
        for (const r of existing) {
          if (!sel[r.seba_category_id]) sel[r.seba_category_id] = [];
          sel[r.seba_category_id].push(r.beddha_number);
        }
        setSebaSelections(sel);
      }
      setLoadingSeba(false);
    }
    loadSeba();
  }, [step]);

  function sf(field: ScalarFormKey) {
    return (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: '' }));
    };
  }

  function validate(): boolean {
    const e: Record<string, string> = {};

    // ── Tab 0: Personal ─────────────────────────────────────────
    if (step === 0) {
      if (!form.first_name.trim()) e.first_name = 'Required';
      if (!form.last_name.trim()) e.last_name = 'Required';
      if (!form.date_of_birth.trim()) e.date_of_birth = 'Required';
      if (!form.gender) e.gender = 'Please select';
      if (!form.health_card_no.trim()) e.health_card_no = 'Required';
      else if (!/^[a-zA-Z0-9]{8}$/.test(form.health_card_no.trim())) e.health_card_no = 'Must be exactly 8 characters';
    }

    // ── Tab 1: Contact & IDs ─────────────────────────────────────
    if (step === 1) {
      const phone = form.primary_phone.replace(/^91/, '');
      if (!phone || !/^\d{10}$/.test(phone)) e.primary_phone = '10-digit phone number required';
      if (form.whatsapp_number.trim() && !/^\d{10}$/.test(form.whatsapp_number.trim())) e.whatsapp_number = '10-digit number required';
      form.extra_phones.forEach((ph, i) => {
        if (ph.trim() && !/^\d{10}$/.test(ph.trim())) e[`extra_${i}`] = '10-digit number required';
      });
      const hasInvalidId = form.id_documents.some((d) => !d.id_type);
      const hasNoId = form.id_documents.length === 0 || (form.id_documents.length === 1 && !form.id_documents[0].id_type);
      if (hasNoId) e.id_documents = 'At least one identity card is required';
      else if (hasInvalidId) e.id_documents = 'Please select ID type for all added cards';
    }

    // ── Tab 2: Seba selection ────────────────────────────────────
    if (step === 2) {
      const totalSelected = Object.values(sebaSelections).reduce((sum, arr) => sum + arr.length, 0);
      if (totalSelected === 0) e.seba_selection = 'Please select at least one seba beddha';
    }

    // ── Tab 3: Family ────────────────────────────────────────────
    if (step === 3) {
      if (!form.father_name.trim()) e.father_name = 'Required';
      if (!form.mother_name.trim()) e.mother_name = 'Required';
      if (!form.marital_status) e.marital_status = 'Please select';
      if (form.marital_status === 'Married') {
        if (!form.spouse_name.trim()) e.spouse_name = 'Required when married';
        if (!form.spouse_father_name.trim()) e.spouse_father_name = "Required when married";
        if (!form.spouse_mother_name.trim()) e.spouse_mother_name = "Required when married";
      }
    }

    // ── Tab 4: Address ───────────────────────────────────────────
    if (step === 4) {
      if (!form.permanent_sahi.trim()) e.permanent_sahi = 'Required';
      if (!form.permanent_landmark.trim()) e.permanent_landmark = 'Required';
      if (!form.permanent_post_office.trim()) e.permanent_post_office = 'Required';
      if (!form.permanent_police_station.trim()) e.permanent_police_station = 'Required';
      if (!form.permanent_pincode.trim()) e.permanent_pincode = 'Required';
      else if (!/^\d{6}$/.test(form.permanent_pincode.trim())) e.permanent_pincode = '6-digit PIN required';
      if (!form.permanent_district.trim()) e.permanent_district = 'Required';
      if (!form.permanent_state.trim()) e.permanent_state = 'Required';
      if (form.is_permanent_different) {
        if (!form.current_sahi.trim()) e.current_sahi = 'Required';
        if (form.current_pincode.trim() && !/^\d{6}$/.test(form.current_pincode.trim())) e.current_pincode = '6-digit PIN required';
      }
    }

    // ── Tab 5: Occupation / Joining date ────────────────────────
    if (step === 5) {
      if (form.joining_date_exact) {
        if (!form.joining_date.trim()) e.joining_date = 'Joining date is required';
      } else {
        if (!form.joining_year.trim()) e.joining_year = 'Joining year is required';
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validate()) return;
    // In change-request mode submit immediately — only one step is editable
    if (isChangeRequest) {
      submit();
      return;
    }
    if (step === 2) {
      setShowSebaConfirmModal(true);
      return;
    }
    if (step < STEPS.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      if (nextStep === 5) {
        setForm((prev) => ({ ...prev, joining_date_exact: true, joining_date: '', joining_year: '' }));
      }
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    } else {
      submit();
    }
  }

  function confirmSebaAndAdvance() {
    setShowSebaConfirmModal(false);
    setStep(3);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function back() {
    if (step > 0) {
      const prevStep = step - 1;
      setStep(prevStep);
      if (prevStep === 4) {
        setForm((prev) => ({ ...prev, joining_date_exact: true, joining_date: '', joining_year: '' }));
      }
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }

  async function submit() {
    if (!validate()) return;
    setSaving(true);
    setSubmitError('');
    const isResub = existingStatus === 'rejected' || existingStatus === 'changes_requested';
    const newStatus = isResub ? 'resubmitted' : 'submitted';
    // Use the actual sebayat row id (may differ from auth user id for admin-pre-created profiles)
    const rowId = sebayatRowId || user!.id;
    const payload = {
      id: rowId,
      phone: user!.user_metadata?.phone || '',
      first_name: form.first_name, middle_name: form.middle_name,
      last_name: form.last_name, alias_name: form.alias_name,
      full_name: [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' '),
      date_of_birth: (() => {
        // Convert internal DD/MM/YYYY → ISO YYYY-MM-DD for DB storage
        const dob = form.date_of_birth;
        const parts = dob.split('/');
        if (parts.length === 3 && parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
        return dob || null;
      })(),
      gender: form.gender, photo_url: form.photo_url,
      is_bhagari: form.is_bhagari, is_baristha_bhai_pua: form.is_baristha_bhai_pua,
      blood_group: form.blood_group, health_card_no: form.health_card_no,
      health_card_photo_url: form.health_card_photo_url,
      whatsapp_number: form.whatsapp_number, email: form.email, primary_phone: form.primary_phone,
      father_name: form.father_name,
      father_sebayat_id: form.father_sebayat_id || null,
      mother_name: form.mother_name,
      marital_status: form.marital_status, spouse_name: form.spouse_name,
      spouse_photo_url: form.spouse_photo_url,
      spouse_father_name: form.spouse_father_name, spouse_mother_name: form.spouse_mother_name,
      spouse_father_photo_url: form.spouse_father_photo_url,
      spouse_mother_photo_url: form.spouse_mother_photo_url,
      permanent_sahi: form.permanent_sahi, permanent_landmark: form.permanent_landmark,
      permanent_post_office: form.permanent_post_office, permanent_police_station: form.permanent_police_station,
      permanent_pincode: form.permanent_pincode, permanent_district: form.permanent_district,
      permanent_state: form.permanent_state, permanent_country: form.permanent_country,
      permanent_address_text: form.permanent_address_text,
      is_permanent_different: form.is_permanent_different,
      current_sahi: form.is_permanent_different ? form.current_sahi : '',
      current_landmark: form.is_permanent_different ? form.current_landmark : '',
      current_post_office: form.is_permanent_different ? form.current_post_office : '',
      current_police_station: form.is_permanent_different ? form.current_police_station : '',
      current_pincode: form.is_permanent_different ? form.current_pincode : '',
      current_district: form.is_permanent_different ? form.current_district : '',
      current_state: form.is_permanent_different ? form.current_state : '',
      current_country: form.is_permanent_different ? form.current_country : 'India',
      current_address_text: form.is_permanent_different ? form.current_address_text : '',
      social_facebook: form.social_facebook, social_twitter: form.social_twitter,
      social_instagram: form.social_instagram, social_linkedin: form.social_linkedin,
      social_youtube: form.social_youtube,
      bansa_name: form.bansa_name, palia_number: form.palia_number, seba_name: form.seba_name,
      joining_date_exact: form.joining_date_exact,
      joining_year: form.joining_year,
      joining_date: form.joining_date_exact ? form.joining_date : '',

      profile_status: newStatus, submitted_at: new Date().toISOString(), admin_remarks: '', change_section: null,
    };
    const { error: upsertErr } = await supabase.from('sebayats').upsert(payload, { onConflict: 'id' });
    if (upsertErr) { setSaving(false); setSubmitError(upsertErr.message); setShowErrorModal(true); return; }
    await Promise.all([
      supabase.from('phone_numbers').delete().eq('sebayat_id', rowId),
      supabase.from('children').delete().eq('sebayat_id', rowId),
      supabase.from('occupations').delete().eq('sebayat_id', rowId),
      supabase.from('identity_documents').delete().eq('sebayat_id', rowId),
    ]);
    const ins: Promise<any>[] = [];
    const xp = form.extra_phones.filter((p) => p.trim());
    if (xp.length > 0) ins.push(supabase.from('phone_numbers').insert(xp.map((p) => ({ sebayat_id: rowId, phone_number: p.trim(), label: 'additional' }))));
    const vc = form.children.filter((c) => c.child_name.trim());
    if (vc.length > 0) ins.push(supabase.from('children').insert(vc.map((c) => ({ sebayat_id: rowId, ...c }))));
    const vo = form.occupations.filter((o) => o.occupation.trim() || o.extra_curriculum_activity.trim());
    if (vo.length > 0) ins.push(supabase.from('occupations').insert(vo.map((o) => ({ sebayat_id: rowId, ...o }))));
    const vid = form.id_documents.filter((d) => d.id_type.trim());
    if (vid.length > 0) ins.push(supabase.from('identity_documents').insert(vid.map((d) => ({ sebayat_id: rowId, ...d }))));
    await Promise.all(ins);

    // Save seba selections
    await supabase.from('sebayat_seba_selections').delete().eq('sebayat_id', rowId);
    const sebaRows: { sebayat_id: string; seba_category_id: string; beddha_number: number }[] = [];
    for (const [catId, nums] of Object.entries(sebaSelections)) {
      for (const num of nums) {
        sebaRows.push({ sebayat_id: rowId, seba_category_id: catId, beddha_number: num });
      }
    }
    if (sebaRows.length > 0) await supabase.from('sebayat_seba_selections').insert(sebaRows);

    await supabase.from('profile_review_history').insert({ sebayat_id: rowId, from_status: existingStatus || 'draft', to_status: newStatus, remarks: isResub ? 'Resubmitted after changes' : 'Initial submission', changed_by: user!.id });

    // Notify admins of new/resubmitted registration
    const name = [form.first_name, form.last_name].filter(Boolean).join(' ') || form.mobile_primary || '';
    sendNotification('registration_submitted', rowId, {
      name,
      phone: form.mobile_primary || '',
      reference_type: 'sebayat',
      reference_id: rowId,
    }, 'admin');

    setSaving(false);
    clearDraft();
    router.replace('/(tabs)');
  }

  // ─── Step 0 — Contact ────────────────────────────────────────────────────────

  function renderStep0() {
    return (
      <>
        <Notice text="These numbers will be used by the Nijog administration to contact you." />

        {/* Primary Phone — locked to login number */}
        <View style={p.fieldWrap}>
          <Label text="Primary Phone" required />
          <View style={s.lockedPhoneRow}>
            <View style={p.iconSlot}><Phone color={T.inkTertiary} size={18} /></View>
            <View style={p.iconDivider} />
            <Text style={s.lockedPhoneTxt}>
              {form.primary_phone
                ? `+91 ${form.primary_phone.replace(/^91/, '')}`
                : '—'}
            </Text>
            <View style={s.lockedBadge}>
              <Lock color={T.inkTertiary} size={12} strokeWidth={2.5} />
              <Text style={s.lockedBadgeTxt}>Login number</Text>
            </View>
          </View>
          <Text style={s.lockedPhoneHint}>To change your login number, contact the Nijog administration.</Text>
        </View>

        {/* WhatsApp Number */}
        <View style={p.fieldWrap}>
          <View style={s.whatsappLabelRow}>
            <Text style={[p.label, { marginBottom: 0 }]}>WHATSAPP NUMBER</Text>
            <TouchableOpacity
              style={s.sameAsPrimaryRow}
              onPress={() => setForm((prev) => ({
                ...prev,
                whatsapp_same_as_primary: !prev.whatsapp_same_as_primary,
                whatsapp_number: !prev.whatsapp_same_as_primary
                  ? prev.primary_phone.replace(/^91/, '')
                  : '',
              }))}
              activeOpacity={0.75}
            >
              <View style={[s.sameCheckBox, form.whatsapp_same_as_primary && s.sameCheckBoxOn]}>
                {form.whatsapp_same_as_primary && <Check color="#fff" size={11} strokeWidth={3} />}
              </View>
              <Text style={s.sameCheckLabel}>Same as primary</Text>
            </TouchableOpacity>
          </View>
          {form.whatsapp_same_as_primary ? (
            <View style={[p.iconInput, s.lockedInput]}>
              <View style={p.iconSlot}><MessageCircle color={T.inkQuaternary} size={18} /></View>
              <View style={[p.iconDivider, { borderColor: T.lineMid }]} />
              <Text style={[{ flex: 1, fontSize: 15, fontFamily: 'Poppins_400Regular', color: T.inkTertiary, paddingHorizontal: 14 }]}>
                {form.primary_phone.replace(/^91/, '') || '—'}
              </Text>
              <View style={[s.lockedBadge, { marginRight: 4 }]}>
                <Lock color={T.inkQuaternary} size={12} strokeWidth={2.5} />
                <Text style={s.lockedBadgeTxt}>auto-filled</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={[p.iconInput, errors.whatsapp_number ? p.iconInputErr : {}]}>
                <View style={p.iconSlot}><MessageCircle color={T.inkTertiary} size={18} /></View>
                <View style={p.iconDivider} />
                <TextInput
                  style={p.iconInputText}
                  value={form.whatsapp_number}
                  onChangeText={(v) => { setForm((p) => ({ ...p, whatsapp_number: v.replace(/\D/g, '') })); setErrors((p) => ({ ...p, whatsapp_number: '' })); }}
                  placeholder="10-digit number"
                  placeholderTextColor={T.inkQuaternary}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                {/^\d{10}$/.test(form.whatsapp_number.trim()) && (
                  <View style={p.validMark}><Check color={T.green} size={12} strokeWidth={3} /></View>
                )}
              </View>
              <ErrMsg msg={errors.whatsapp_number} />
            </>
          )}
        </View>

        {/* Email */}
        <View style={p.fieldWrap}>
          <Label text="Email Address" />
          <View style={[p.iconInput, errors.email ? p.iconInputErr : {}, form.email && !errors.email ? p.iconInputFocused : {}]}>
            <View style={p.iconSlot}><Mail color={T.inkTertiary} size={18} /></View>
            <View style={p.iconDivider} />
            <TextInput
              style={p.iconInputText}
              value={form.email}
              onChangeText={(v) => { setForm((p) => ({ ...p, email: v.trim() })); setErrors((p) => ({ ...p, email: '' })); }}
              placeholder="example@email.com"
              placeholderTextColor={T.inkQuaternary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && (
              <View style={p.validMark}><Check color={T.green} size={12} strokeWidth={3} /></View>
            )}
          </View>
          <ErrMsg msg={errors.email} />
        </View>

        {form.extra_phones.length > 0 && (
          <View style={s.fieldWrap}>
            <Label text="Additional Numbers" />
            {form.extra_phones.map((ph, i) => (
              <View key={i} style={{ marginBottom: 10 }}>
                <View style={s.extraPhoneRow}>
                  <TextInput
                    style={[p.input, { flex: 1 }, errors[`extra_${i}`] && p.inputErr]}
                    value={ph}
                    onChangeText={(v) => {
                      const upd = [...form.extra_phones];
                      upd[i] = v.replace(/\D/g, '');
                      setForm((prev) => ({ ...prev, extra_phones: upd }));
                      setErrors((prev) => ({ ...prev, [`extra_${i}`]: '' }));
                    }}
                    placeholder={`Number ${i + 1}`}
                    placeholderTextColor={T.inkQuaternary}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                  <TouchableOpacity
                    style={s.delBtn}
                    onPress={() => setForm((prev) => ({ ...prev, extra_phones: prev.extra_phones.filter((_, idx) => idx !== i) }))}
                    activeOpacity={0.7}
                  >
                    <Trash2 color={T.red} size={16} />
                  </TouchableOpacity>
                </View>
                <ErrMsg msg={errors[`extra_${i}`]} />
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={s.addRow} onPress={() => setForm((p) => ({ ...p, extra_phones: [...p.extra_phones, ''] }))} activeOpacity={0.7}>
          <Plus color={T.primary} size={15} />
          <Text style={s.addRowTxt}>Add another number</Text>
        </TouchableOpacity>

        {/* ── Identity Cards ── */}
        <View style={s.infoCard}>
          <View style={s.infoCardHeader}>
            <CreditCard color={T.primary} size={15} strokeWidth={2.5} />
            <Text style={s.infoCardTitle}>Identity Cards</Text>
          </View>
          <View style={s.infoCardBody}>
            <Text style={s.idCardNotice}>Attach one or more government IDs. Duplicate types are prevented.</Text>
            {errors.id_documents ? <Text style={p.errMsg}>{errors.id_documents}</Text> : null}
            {form.id_documents.map((doc, i) => {
              const usedTypes = form.id_documents.filter((_, idx) => idx !== i).map((d) => d.id_type);
              const availableTypes = ID_TYPES.filter((t) => !usedTypes.includes(t));
              return (
                <View key={i}>
                  {i > 0 && <View style={s.infoCardDivider} />}
                  <View style={s.idDocRow}>
                    <View style={{ flex: 1 }}>
                      <SelectField
                        label="ID Type"
                        value={doc.id_type}
                        options={availableTypes}
                        placeholder="Select ID type"
                        onChange={(v) => {
                          const upd = [...form.id_documents];
                          upd[i] = { ...upd[i], id_type: v };
                          setForm((prev) => ({ ...prev, id_documents: upd }));
                        }}
                      />
                    </View>
                    {form.id_documents.length > 1 && (
                      <TouchableOpacity
                        style={[s.delBtn, { marginTop: 20 }]}
                        onPress={() => setForm((prev) => ({ ...prev, id_documents: prev.id_documents.filter((_, idx) => idx !== i) }))}
                        activeOpacity={0.7}
                      >
                        <Trash2 color={T.red} size={15} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity
                    style={s.uploadRow}
                    activeOpacity={0.75}
                    onPress={() => pickAndUpload(`id-doc-${i}`, (url) => {
                      const upd = [...form.id_documents];
                      upd[i] = { ...upd[i], photo_url: url };
                      setForm((prev) => ({ ...prev, id_documents: upd }));
                    })}
                  >
                    <View style={s.uploadIcon}>
                      <Camera color={T.primary} size={18} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.uploadTitle}>{doc.photo_url ? 'Photo uploaded' : 'Upload ID photo'}</Text>
                      <Text style={s.uploadSub}>{doc.photo_url ? 'Tap to replace' : 'Front side · JPG or PNG'}</Text>
                    </View>
                    {uploadingKey === `id-doc-${i}`
                      ? <ActivityIndicator size="small" color={T.primary} />
                      : doc.photo_url
                        ? <Check color={T.green} size={16} strokeWidth={2.5} />
                        : <Upload color={T.inkQuaternary} size={16} />
                    }
                  </TouchableOpacity>
                </View>
              );
            })}
            {form.id_documents.length < ID_TYPES.length && (
              <TouchableOpacity
                style={[s.addRow, { marginTop: 12, marginBottom: 0 }]}
                onPress={() => setForm((prev) => ({ ...prev, id_documents: [...prev.id_documents, { id_type: '', photo_url: '' }] }))}
                activeOpacity={0.7}
              >
                <Plus color={T.primary} size={15} />
                <Text style={s.addRowTxt}>Add another ID</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </>
    );
  }

  // ─── Step 1 — Personal ───────────────────────────────────────────────────────

  function renderStep1() {
    const parts = form.date_of_birth.split('/');
    const dobD = parts[0] || '';
    const dobM = parts[1] || '';
    const dobY = parts[2] || '';
    function setDob(part: 'day' | 'month' | 'year', val: string) {
      const d = part === 'day' ? val : dobD;
      const m = part === 'month' ? val : dobM;
      const y = part === 'year' ? val : dobY;
      setForm((prev) => ({ ...prev, date_of_birth: `${d}/${m}/${y}` }));
      setErrors((prev) => ({ ...prev, date_of_birth: '' }));
    }
    const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
    const months = [
      { label: 'Jan', val: '01' }, { label: 'Feb', val: '02' }, { label: 'Mar', val: '03' },
      { label: 'Apr', val: '04' }, { label: 'May', val: '05' }, { label: 'Jun', val: '06' },
      { label: 'Jul', val: '07' }, { label: 'Aug', val: '08' }, { label: 'Sep', val: '09' },
      { label: 'Oct', val: '10' }, { label: 'Nov', val: '11' }, { label: 'Dec', val: '12' },
    ];
    const yr = new Date().getFullYear();
    const years = Array.from({ length: 100 }, (_, i) => String(yr - i));

    return (
      <>
        {/* Avatar */}
        <TouchableOpacity
          style={s.avatar}
          activeOpacity={0.8}
          onPress={() => pickAndUpload('profile-photo', (url) => setForm((p) => ({ ...p, photo_url: url })))}
        >
          <View style={[s.avatarCircle, form.photo_url ? { borderWidth: 0, padding: 0, overflow: 'hidden' } : {}]}>
            {form.photo_url
              ? <Image source={{ uri: form.photo_url }} style={{ width: 52, height: 52, borderRadius: 26 }} />
              : uploadingKey === 'profile-photo'
                ? <ActivityIndicator size="small" color={T.primary} />
                : <Camera color={T.inkQuaternary} size={26} />
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.avatarTitle}>{form.photo_url ? 'Photo uploaded' : 'Profile Photo'}</Text>
            <Text style={s.avatarSub}>{form.photo_url ? 'Tap to replace' : 'Optional · tap to upload'}</Text>
          </View>
          {form.photo_url && <Check color={T.green} size={16} strokeWidth={2.5} />}
        </TouchableOpacity>

        {/* ── Identity card ── */}
        <View style={s.infoCard}>
          <View style={s.infoCardHeader}>
            <User color={T.primary} size={15} strokeWidth={2.5} />
            <Text style={s.infoCardTitle}>Identity</Text>
          </View>
          <View style={s.infoCardBody}>
            {/* Name grid */}
            <View style={s.fieldWrap}>
              <Label text="Full Name" required />
              <View style={s.nameGrid}>
                {([
                  { field: 'first_name' as ScalarFormKey, ph: 'First name', err: errors.first_name },
                  { field: 'middle_name' as ScalarFormKey, ph: 'Middle name', err: undefined },
                  { field: 'last_name' as ScalarFormKey, ph: 'Last name', err: errors.last_name },
                  { field: 'alias_name' as ScalarFormKey, ph: 'Alias / known as', err: undefined },
                ] as { field: ScalarFormKey; ph: string; err: string | undefined }[]).map(({ field, ph, err }) => (
                  <View key={field} style={s.nameCell}>
                    <NameInput
                      value={form[field] as string}
                      onChange={sf(field)}
                      placeholder={ph}
                      error={!!err}
                    />
                  </View>
                ))}
              </View>
              {(errors.first_name || errors.last_name) && (
                <Text style={p.errMsg}>{errors.first_name || errors.last_name}</Text>
              )}
            </View>

            <View style={s.infoCardDivider} />

            {/* DOB */}
            <View style={p.fieldWrap}>
              <Label text="Date of Birth" required />
              <TouchableOpacity
                style={[p.input, s.dobTrigger, !!errors.date_of_birth && p.inputErr]}
                onPress={() => setDobOpen(true)}
                activeOpacity={0.75}
              >
                <Calendar color={dobD && dobM && dobY ? T.primary : T.inkQuaternary} size={16} />
                <Text style={dobD && dobM && dobY ? s.dobTriggerTxt : s.dobTriggerPh}>
                  {dobD && dobM && dobY ? `${dobD} / ${dobM} / ${dobY}` : 'Select date of birth'}
                </Text>
                {dobD && dobM && dobY && (
                  <TouchableOpacity onPress={() => setForm((prev) => ({ ...prev, date_of_birth: '' }))} hitSlop={8}>
                    <X color={T.inkTertiary} size={14} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              <ErrMsg msg={errors.date_of_birth} />
              <Modal visible={dobOpen} animationType="slide" transparent onRequestClose={() => setDobOpen(false)}>
                <View style={sel.overlay}>
                  <View style={[sel.sheet, { maxHeight: '55%' }]}>
                    <View style={sel.sheetHead}>
                      <Text style={sel.sheetTitle}>Date of Birth</Text>
                      <TouchableOpacity onPress={() => setDobOpen(false)} style={sel.sheetClose}>
                        <X color={T.inkSecondary} size={20} />
                      </TouchableOpacity>
                    </View>
                    <View style={s.dobRow}>
                      <View style={s.dobSeg}>
                        <Text style={s.dobSegHdr}>Day</Text>
                        <ScrollView style={s.dobList} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                          {days.map((d) => (
                            <TouchableOpacity key={d} style={[s.dobItem, dobD === d && s.dobItemSel]} onPress={() => setDob('day', d)} activeOpacity={0.7}>
                              <Text style={[s.dobItemTxt, dobD === d && s.dobItemTxtSel]}>{d}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      <View style={s.dobSepLine} />
                      <View style={[s.dobSeg, { flex: 1.3 }]}>
                        <Text style={s.dobSegHdr}>Month</Text>
                        <ScrollView style={s.dobList} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                          {months.map(({ label, val }) => (
                            <TouchableOpacity key={val} style={[s.dobItem, dobM === val && s.dobItemSel]} onPress={() => setDob('month', val)} activeOpacity={0.7}>
                              <Text style={[s.dobItemTxt, dobM === val && s.dobItemTxtSel]}>{label}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      <View style={s.dobSepLine} />
                      <View style={[s.dobSeg, { flex: 1.5 }]}>
                        <Text style={s.dobSegHdr}>Year</Text>
                        <ScrollView style={s.dobList} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                          {years.map((y) => (
                            <TouchableOpacity key={y} style={[s.dobItem, dobY === y && s.dobItemSel]} onPress={() => setDob('year', y)} activeOpacity={0.7}>
                              <Text style={[s.dobItemTxt, dobY === y && s.dobItemTxtSel]}>{y}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                    <View style={s.dobModalFooter}>
                      <TouchableOpacity
                        style={s.dobModalDone}
                        onPress={() => setDobOpen(false)}
                        activeOpacity={0.8}
                      >
                        <Text style={s.dobModalDoneTxt}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            </View>

            <View style={s.infoCardDivider} />

            <Chips label="Gender" value={form.gender} options={['Male', 'Female']} onSelect={sf('gender')} required error={errors.gender} />
          </View>
        </View>

        {/* ── Status card ── */}
        <View style={p.fieldWrap}>
          <Label text="Sebayat Status" />
          <View style={s.radioGroup}>
            {[
              { label: 'Bhagari', desc: 'Participates in Bhagari seba', key: 'bhagari' },
              { label: 'Baristha Bhai Pua', desc: 'Senior sebayat (Baristha Bhai Pua)', key: 'baristha' },
              { label: 'None', desc: 'Neither of the above', key: 'none' },
            ].map((opt) => {
              const selected =
                opt.key === 'bhagari' ? form.is_bhagari :
                opt.key === 'baristha' ? form.is_baristha_bhai_pua :
                !form.is_bhagari && !form.is_baristha_bhai_pua;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.radioRow, selected && s.radioRowSelected]}
                  activeOpacity={0.75}
                  onPress={() => setForm((prev) => ({
                    ...prev,
                    is_bhagari: opt.key === 'bhagari',
                    is_baristha_bhai_pua: opt.key === 'baristha',
                  }))}
                >
                  <View style={[s.radioCircle, selected && s.radioCircleSelected]}>
                    {selected && <View style={s.radioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.radioLabel, selected && s.radioLabelSelected]}>{opt.label}</Text>
                    <Text style={s.radioDesc}>{opt.desc}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Health card ── */}
        <View style={s.infoCard}>
          <View style={s.infoCardHeader}>
            <Heart color={T.primary} size={15} strokeWidth={2.5} />
            <Text style={s.infoCardTitle}>Health</Text>
          </View>
          <View style={s.infoCardBody}>
            <SelectField
              label="Blood Group"
              value={form.blood_group}
              options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']}
              placeholder="Select blood group"
              onChange={(v) => setForm((prev) => ({ ...prev, blood_group: v }))}
            />
            <View style={s.infoCardDivider} />
            <Field
              label="Health Card No"
              value={form.health_card_no}
              onChange={(v) => setForm((prev) => ({ ...prev, health_card_no: v.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() }))}
              placeholder="8-character alphanumeric"
              maxLen={8}
              noCap
              required
              error={errors.health_card_no}
            />
            <View style={s.infoCardDivider} />
            <View style={p.fieldWrap}>
              <Label text="Health Card Photo" />
              <TouchableOpacity
                style={s.uploadRow}
                activeOpacity={0.75}
                onPress={() => pickAndUpload('health-card', (url) => setForm((p) => ({ ...p, health_card_photo_url: url })))}
              >
                <View style={s.uploadIcon}>
                  <CreditCard color={T.primary} size={18} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.uploadTitle}>
                    {form.health_card_photo_url ? 'Card uploaded' : 'Upload health card'}
                  </Text>
                  <Text style={s.uploadSub}>
                    {form.health_card_photo_url ? 'Tap to replace' : 'JPG or PNG · optional'}
                  </Text>
                </View>
                {uploadingKey === 'health-card'
                  ? <ActivityIndicator size="small" color={T.primary} />
                  : form.health_card_photo_url
                    ? <Check color={T.green} size={16} strokeWidth={2.5} />
                    : <Upload color={T.inkQuaternary} size={16} />
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </>
    );
  }

  // ─── Step 2 — Family ─────────────────────────────────────────────────────────

  function renderStep2() {
    const married = form.marital_status === 'Married';
    return (
      <>
        <FatherSearchField
          value={form.father_name}
          linkedId={form.father_sebayat_id}
          onChange={(name, id) => {
            setForm((prev) => ({ ...prev, father_name: name, father_sebayat_id: id }));
            setErrors((prev) => ({ ...prev, father_name: '' }));
          }}
          error={errors.father_name}
        />
        <Field label="Mother's Name" value={form.mother_name} onChange={sf('mother_name')} placeholder="Full name" required error={errors.mother_name} />
        <Chips label="Marital Status" value={form.marital_status} options={['Unmarried', 'Married']} onSelect={sf('marital_status')} required error={errors.marital_status} />

        {married && (
          <>
            <Divider title="Spouse Details" />
            <Field label="Spouse's Name" value={form.spouse_name} onChange={sf('spouse_name')} placeholder="Full name" required error={errors.spouse_name} />
            <Field label="Spouse Father's Name" value={form.spouse_father_name} onChange={sf('spouse_father_name')} placeholder="Full name" required error={errors.spouse_father_name} />
            <Field label="Spouse Mother's Name" value={form.spouse_mother_name} onChange={sf('spouse_mother_name')} placeholder="Full name" required error={errors.spouse_mother_name} />

            <Divider title="Children" />
            {form.children.map((child, i) => (
              <View key={i} style={s.card}>
                <View style={s.cardHead}>
                  <Text style={s.cardHeadTxt}>Child {i + 1}</Text>
                  <TouchableOpacity style={s.delBtn} onPress={() => setForm((prev) => ({ ...prev, children: prev.children.filter((_, idx) => idx !== i) }))} activeOpacity={0.7}>
                    <Trash2 color={T.red} size={15} />
                  </TouchableOpacity>
                </View>
                <Field label="Name" value={child.child_name} onChange={(v) => { const u = [...form.children]; u[i] = { ...u[i], child_name: v }; setForm((prev) => ({ ...prev, children: u })); }} placeholder="Full name" />
                <Chips label="Gender" value={child.gender} options={['Male', 'Female']} onSelect={(v) => { const u = [...form.children]; u[i] = { ...u[i], gender: v }; setForm((prev) => ({ ...prev, children: u })); }} />
                <Chips label="Marital Status" value={child.marital_status} options={['Single', 'Married']} onSelect={(v) => { const u = [...form.children]; u[i] = { ...u[i], marital_status: v }; setForm((prev) => ({ ...prev, children: u })); }} />
              </View>
            ))}
            <TouchableOpacity style={s.addRow} onPress={() => setForm((prev) => ({ ...prev, children: [...prev.children, { child_name: '', date_of_birth: '', gender: '', marital_status: '', photo_url: '' }] }))} activeOpacity={0.7}>
              <Plus color={T.primary} size={15} />
              <Text style={s.addRowTxt}>Add child</Text>
            </TouchableOpacity>
          </>
        )}
      </>
    );
  }

  // ─── Step 3 — Address ────────────────────────────────────────────────────────

  function renderAddressBlock(prefix: 'current' | 'permanent') {
    const k = (suffix: string) => `${prefix}_${suffix}` as ScalarFormKey;
    const isPrimary = prefix === 'permanent';
    return (
      <>
        <View style={s.row2}>
          <View style={s.col2}><Field label="Sahi / Mohalla" value={form[k('sahi')]} onChange={sf(k('sahi'))} placeholder="e.g. Badaghara Sahi" required={isPrimary} error={errors[k('sahi')]} /></View>
          <View style={s.col2}><Field label="Landmark" value={form[k('landmark')]} onChange={sf(k('landmark'))} placeholder="Nearby landmark" required={isPrimary} error={errors[k('landmark')]} /></View>
          <View style={s.col2}><Field label="Post Office" value={form[k('post_office')]} onChange={sf(k('post_office'))} placeholder="Post office" required={isPrimary} error={errors[k('post_office')]} /></View>
          <View style={s.col2}><Field label="Police Station" value={form[k('police_station')]} onChange={sf(k('police_station'))} placeholder="Police station" required={isPrimary} error={errors[k('police_station')]} /></View>
          <View style={s.col2}><Field label="PIN Code" value={form[k('pincode')]} onChange={sf(k('pincode'))} kbd="number-pad" maxLen={6} placeholder="6-digit PIN" required={isPrimary} error={errors[k('pincode')]} /></View>
          <View style={s.col2}><Field label="District" value={form[k('district')]} onChange={sf(k('district'))} placeholder="e.g. Puri" required={isPrimary} error={errors[k('district')]} /></View>
          <View style={s.col2}><Field label="State" value={form[k('state')]} onChange={sf(k('state'))} placeholder="e.g. Odisha" required={isPrimary} error={errors[k('state')]} /></View>
          <View style={s.col2}><Field label="Country" value={form[k('country')]} onChange={sf(k('country'))} placeholder="India" /></View>
        </View>
        <Field label="Full Address" value={form[k('address_text')]} onChange={sf(k('address_text'))} placeholder="House no., street, area…" multiline />
      </>
    );
  }

  function renderStep3() {
    return (
      <>
        <Text style={s.addrHeading}>Permanent Address</Text>
        {renderAddressBlock('permanent')}

        <View style={[s.toggleGroup, { marginBottom: 24 }]}>
          <ToggleRow
            label="Current address is different"
            desc="Enable to fill in a different current address"
            value={form.is_permanent_different}
            onChange={(v) => setForm((prev) => ({ ...prev, is_permanent_different: v }))}
          />
        </View>

        {form.is_permanent_different && (
          <>
            <Text style={s.addrHeading}>Current Address</Text>
            {renderAddressBlock('current')}
          </>
        )}
      </>
    );
  }

  // ─── Step 4 — Occupation ─────────────────────────────────────────────────────

  function renderStep4() {
    return (
      <>
        {/* ── Joining Nijog ── */}
        <View style={s.infoCard}>
          <View style={s.infoCardHeader}>
            <Calendar color={T.primary} size={15} strokeWidth={2.5} />
            <Text style={s.infoCardTitle}>Joining Nijog</Text>
          </View>
          <View style={s.infoCardBody}>
            {/* Date/Year picker — label always shows */}
            <View style={p.fieldWrap}>
              <Text style={s.joiningPickerLabel}>{form.joining_date_exact ? 'Date of Joining' : 'Year of Joining'}</Text>
              <TouchableOpacity style={s.joiningTrigger} onPress={() => setJoiningOpen(true)} activeOpacity={0.8}>
                <View style={s.joiningTriggerIcon}><Calendar color="#fff" size={18} /></View>
                {form.joining_date_exact ? (
                  <>
                    <Text style={form.joining_date ? s.joiningTriggerTxt : s.joiningTriggerPh}>
                      {form.joining_date || 'dd/mm/yyyy'}
                    </Text>
                    {form.joining_date ? (
                      <TouchableOpacity onPress={() => setForm((p) => ({ ...p, joining_date: '' }))} hitSlop={8}>
                        <X color={T.inkTertiary} size={14} />
                      </TouchableOpacity>
                    ) : (
                      <Calendar color={T.inkQuaternary} size={16} />
                    )}
                  </>
                ) : (
                  <>
                    <Text style={form.joining_year ? s.joiningTriggerTxt : s.joiningTriggerPh}>
                      {form.joining_year || 'Select Year'}
                    </Text>
                    {form.joining_year && (
                      <TouchableOpacity onPress={() => setForm((p) => ({ ...p, joining_year: '' }))} hitSlop={8}>
                        <X color={T.inkTertiary} size={14} />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Checkbox below the date field */}
            <TouchableOpacity
              style={s.joiningCheckRow}
              onPress={() => setForm((prev) => ({ ...prev, joining_date_exact: !prev.joining_date_exact, joining_date: '', joining_year: '' }))}
              activeOpacity={0.75}
            >
              <View style={[s.joiningCheckBox, !form.joining_date_exact && s.joiningCheckBoxOn]}>
                {!form.joining_date_exact && <Check color="#fff" size={12} strokeWidth={3} />}
              </View>
              <Text style={s.joiningCheckLabel}>I do not remember the exact date</Text>
            </TouchableOpacity>

            {!form.joining_date_exact && (
              <View style={s.joiningHintRow}>
                <Info color={T.primary} size={13} strokeWidth={2.5} />
                <Text style={s.joiningHintTxt}>Please enter the year you joined instead.</Text>
              </View>
            )}
            {(errors.joining_date || errors.joining_year) ? (
              <Text style={[p.errMsg, { marginTop: 4 }]}>{errors.joining_date || errors.joining_year}</Text>
            ) : null}
          </View>
        </View>

        {/* Joining date/year picker modal */}
        <JoiningPickerModal
          visible={joiningOpen}
          exact={form.joining_date_exact}
          date={form.joining_date}
          year={form.joining_year}
          onChangeFull={(d) => setForm((prev) => ({ ...prev, joining_date: d }))}
          onChangeYear={(y) => setForm((prev) => ({ ...prev, joining_year: y }))}
          onClose={() => setJoiningOpen(false)}
        />

        {/* ── Occupations ── */}
        {form.occupations.map((occ, i) => (
          <View key={i} style={s.card}>
            <View style={s.cardHead}>
              <View style={s.cardNum}><Text style={s.cardNumTxt}>{i + 1}</Text></View>
              <Text style={s.cardHeadTxt}>Occupation</Text>
              {form.occupations.length > 1 && (
                <TouchableOpacity style={s.delBtn} onPress={() => setForm((prev) => ({ ...prev, occupations: prev.occupations.filter((_, idx) => idx !== i) }))} activeOpacity={0.7}>
                  <Trash2 color={T.red} size={15} />
                </TouchableOpacity>
              )}
            </View>
            <Field label="Occupation" value={occ.occupation} onChange={(v) => { const u = [...form.occupations]; u[i] = { ...u[i], occupation: v }; setForm((prev) => ({ ...prev, occupations: u })); }} placeholder="e.g. Teacher, Engineer" />
            <Field label="Extra Curriculum Activity" value={occ.extra_curriculum_activity} onChange={(v) => { const u = [...form.occupations]; u[i] = { ...u[i], extra_curriculum_activity: v }; setForm((prev) => ({ ...prev, occupations: u })); }} placeholder="e.g. Sports coaching" />
          </View>
        ))}
        <TouchableOpacity style={s.addRow} onPress={() => setForm((prev) => ({ ...prev, occupations: [...prev.occupations, { occupation: '', extra_curriculum_activity: '' }] }))} activeOpacity={0.7}>
          <Plus color={T.primary} size={15} />
          <Text style={s.addRowTxt}>Add another occupation</Text>
        </TouchableOpacity>
      </>
    );
  }

  // ─── Step 5 — Social ─────────────────────────────────────────────────────────

  function renderStep5() {
    const socials: { key: ScalarFormKey; label: string; ph: string; Icon: any; color: string }[] = [
      { key: 'social_facebook', label: 'Facebook', ph: 'facebook.com/...', Icon: Facebook, color: '#1877F2' },
      { key: 'social_twitter', label: 'Twitter / X', ph: 'x.com/...', Icon: Twitter, color: '#0F1419' },
      { key: 'social_instagram', label: 'Instagram', ph: 'instagram.com/...', Icon: Instagram, color: '#C13584' },
      { key: 'social_linkedin', label: 'LinkedIn', ph: 'linkedin.com/in/...', Icon: Linkedin, color: '#0A66C2' },
      { key: 'social_youtube', label: 'YouTube', ph: 'youtube.com/@...', Icon: Youtube, color: '#FF0000' },
    ];
    return (
      <>
        <Notice text="All social media fields are optional." />
        {socials.map(({ key, label, ph, Icon, color }) => {
          const filled = (form[key] as string).length > 0;
          return (
            <View key={key} style={p.fieldWrap}>
              <Label text={label} />
              <View style={[s.socialRow, filled && s.socialRowFilled]}>
                <View style={[s.socialIcon, { backgroundColor: color + '18' }]}>
                  <Icon color={color} size={18} />
                </View>
                <TextInput
                  style={s.socialInput}
                  value={form[key] as string}
                  onChangeText={sf(key)}
                  placeholder={ph}
                  placeholderTextColor={T.inkQuaternary}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </View>
            </View>
          );
        })}
      </>
    );
  }

  // ─── Step 6 — Seba ───────────────────────────────────────────────────────────

  function toggleBeddha(catId: string, num: number) {
    setSebaSelections((prev) => {
      const current = prev[catId] || [];
      const idx = current.indexOf(num);
      if (idx >= 0) {
        const updated = current.filter((n) => n !== num);
        return { ...prev, [catId]: updated };
      } else {
        return { ...prev, [catId]: [...current, num] };
      }
    });
  }

  function renderStep6() {
    if (loadingSeba) {
      return (
        <View style={s.sebaLoadWrap}>
          <ActivityIndicator color={T.primary} size="large" />
          <Text style={s.sebaLoadTxt}>Loading seba details…</Text>
        </View>
      );
    }

    const visibleCats = sebaCategories.filter((cat) => !HIDDEN_SEBAS.includes(cat.name));
    const totalSelected = Object.values(sebaSelections).reduce((sum, arr) => sum + arr.length, 0);

    return (
      <>
        <Notice text="Select the beddha numbers you perform. Nijog-assigned beddhas (shown grey with N) are managed by the administration and cannot be selected." />
        {errors.seba_selection ? <Text style={[p.errMsg, { marginBottom: 8 }]}>{errors.seba_selection}</Text> : null}

        {totalSelected > 0 && (
          <View style={s.sebaSelCount}>
            <Check color={T.primary} size={14} strokeWidth={3} />
            <Text style={s.sebaSelCountTxt}>{totalSelected} beddha{totalSelected !== 1 ? 's' : ''} selected across all sebas</Text>
          </View>
        )}

        {visibleCats.length === 0 ? (
          <View style={s.sebaEmpty}>
            <Text style={s.sebaEmptyTxt}>No seba categories configured yet.</Text>
          </View>
        ) : (
          visibleCats.map((cat) => {
            const beddhaTypes = sebaBeddhaMap[cat.id] || {};
            const selected = sebaSelections[cat.id] || [];
            const count = cat.beddha_count || 0;
            const catSelectedCount = selected.length;
            const isOpen = !!sebaExpanded[cat.id];

            return (
              <View key={cat.id} style={s.sebaCatCard}>
                <TouchableOpacity
                  style={s.sebaCatHeader}
                  activeOpacity={0.75}
                  onPress={() => setSebaExpanded((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                >
                  <Text style={s.sebaCatName}>{isOdia && cat.name_or ? cat.name_or : cat.name}</Text>
                  <View style={s.sebaCatBadgeRow}>
                    {catSelectedCount > 0 && (
                      <View style={s.sebaCatSelBadge}>
                        <Text style={s.sebaCatSelBadgeTxt}>{catSelectedCount} selected</Text>
                      </View>
                    )}
                    <View style={s.sebaCatCountBadge}>
                      <Text style={s.sebaCatCountTxt}>{count}</Text>
                    </View>
                    <ChevronRight
                      color={T.inkTertiary}
                      size={15}
                      style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
                    />
                  </View>
                </TouchableOpacity>

                {isOpen && (
                  <>
                    <View style={s.sebaBeddhaGrid}>
                      {Array.from({ length: count }, (_, i) => i + 1).map((num) => {
                        const bType = beddhaTypes[num];
                        const isNijog = bType === 'nijog_assigned';
                        const isSelected = selected.includes(num);

                        if (isNijog) {
                          return (
                            <View key={num} style={s.beddhaDisabled}>
                              <Text style={s.beddhaDisabledNum}>{num}</Text>
                              <Text style={s.beddhaDisabledLabel}>N</Text>
                            </View>
                          );
                        }

                        return (
                          <TouchableOpacity
                            key={num}
                            style={[s.beddha, isSelected && s.beddhaSelected]}
                            onPress={() => toggleBeddha(cat.id, num)}
                            activeOpacity={0.7}
                          >
                            {isSelected && (
                              <View style={s.beddhaCheckDot}>
                                <Check color="#fff" size={7} strokeWidth={3.5} />
                              </View>
                            )}
                            <Text style={[s.beddhaNum, isSelected && s.beddhaNumSelected]}>{num}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={s.sebaCatLegend}>
                      <View style={s.legendItem}>
                        <View style={[s.legendDot, { backgroundColor: T.primary }]} />
                        <Text style={s.legendTxt}>Selected</Text>
                      </View>
                      <View style={s.legendItem}>
                        <View style={[s.legendDot, { backgroundColor: '#E5E7EB' }]} />
                        <Text style={s.legendTxt}>Available</Text>
                      </View>
                      <View style={s.legendItem}>
                        <View style={[s.legendDot, { backgroundColor: '#D1D5DB', borderWidth: 1, borderColor: '#9CA3AF' }]} />
                        <Text style={s.legendTxt}>N — Nijog assigned</Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            );
          })
        )}

      </>
    );
  }

  function renderStep() {
    switch (step) {
      case 0: return renderStep1();   // Personal
      case 1: return renderStep0();   // Contact & IDs
      case 2: return renderStep6();   // Seba
      case 3: return renderStep2();   // Family
      case 4: return renderStep3();   // Address
      case 5: return renderStep4();   // Occupation
      case 6: return renderStep5();   // Social
      default: return null;
    }
  }

  if (loadingExisting) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loadWrap}>
          <ActivityIndicator color={T.primary} size="large" />
          <Text style={s.loadTxt}>Loading profile…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* ── Header ─────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.headerEye}>Pratihari Nijog</Text>
            <Text style={s.headerTitle}>{isChangeRequest ? 'Update & Resubmit' : 'Sebayat Registration'}</Text>
          </View>
          {!isChangeRequest && (
            <View style={s.headerPill}>
              <Text style={s.headerPillTxt}>{step + 1} / {STEPS.length}</Text>
            </View>
          )}
        </View>

        {/* ── Progress ────────────────────────────────────────── */}
        {!isChangeRequest && (
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` as any }]} />
          </View>
        )}

        {/* ── Step tabs (full registration) / section badge (change request) ── */}
        {isChangeRequest ? (
          <View style={s.changeRequestStepBadge}>
            <AlertCircle color="#92400e" size={14} strokeWidth={2.5} />
            <Text style={s.changeRequestStepText}>
              Editing: <Text style={s.changeRequestStepName}>{STEPS[changeRequestStep]}</Text>
            </Text>
          </View>
        ) : (
          <>
            <View style={s.stepRow}>
              {STEPS.map((name, i) => {
                const done = i < step;
                const active = i === step;
                return (
                  <View key={i} style={s.stepItem}>
                    {i > 0 && <View style={[s.stepConnector, done && s.stepConnectorDone]} />}
                    <View style={[s.stepDot, done && s.stepDotDone, active && s.stepDotActive]}>
                      {done
                        ? <Check color="#fff" size={9} strokeWidth={3.5} />
                        : <Text style={[s.stepN, active && s.stepNActive]}>{i + 1}</Text>
                      }
                    </View>
                  </View>
                );
              })}
            </View>
            <Text style={s.stepName}>{STEPS[step]}</Text>
          </>
        )}

        {/* ── Form ────────────────────────────────────────────── */}
        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {(existingStatus === 'changes_requested' || existingStatus === 'rejected') && adminRemarks ? (
            <View style={[s.remarksBanner, existingStatus === 'rejected' && s.remarksBannerRejected]}>
              <View style={s.remarksBannerHeader}>
                <AlertCircle color={existingStatus === 'rejected' ? '#991B1B' : '#92400e'} size={15} strokeWidth={2.5} />
                <Text style={[s.remarksBannerTitle, existingStatus === 'rejected' && s.remarksBannerTitleRejected]}>
                  {existingStatus === 'rejected' ? 'Rejection Reason' : 'Admin Remarks'}
                </Text>
              </View>
              <Text style={[s.remarksBannerText, existingStatus === 'rejected' && s.remarksBannerTextRejected]}>{adminRemarks}</Text>
            </View>
          ) : null}

          {renderStep()}


          {/* ── Nav ──────────────────────────────────────────── */}
          <View style={s.nav}>
            {!isChangeRequest && step > 0 ? (
              <TouchableOpacity style={s.backBtn} onPress={back} activeOpacity={0.7}>
                <ChevronLeft color={T.inkSecondary} size={18} />
                <Text style={s.backBtnTxt}>Back</Text>
              </TouchableOpacity>
            ) : <View />}

            <TouchableOpacity
              style={[s.nextBtn, (saving || (!isChangeRequest && step === STEPS.length - 1)) && s.nextBtnDis]}
              onPress={next}
              disabled={saving}
              activeOpacity={isChangeRequest || step === STEPS.length - 1 ? 0.6 : 0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : isChangeRequest
                  ? <><Lock color="#fff" size={14} strokeWidth={2.5} /><Text style={s.nextBtnTxt}>Submit Changes</Text></>
                  : step === STEPS.length - 1
                    ? <><Lock color="#fff" size={14} strokeWidth={2.5} /><Text style={s.nextBtnTxt}>Submit for Approval</Text></>
                    : <><Text style={s.nextBtnTxt}>Continue</Text><ChevronRight color="#fff" size={18} /></>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Submit Confirmation Modal ─────────────────────────── */}
      <Modal
        visible={showSubmitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSubmitModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.confirmModal}>
            <View style={s.confirmModalHeader}>
              <View style={s.confirmModalIconWrap}>
                <Check color={T.green} size={22} strokeWidth={2.5} />
              </View>
              <Text style={s.confirmModalTitle}>Confirm Submission</Text>
              <Text style={s.confirmModalSub}>Review your seba selections before submitting for approval.</Text>
            </View>

            <ScrollView style={s.confirmModalBody} showsVerticalScrollIndicator={false}>
              {(() => {
                const visibleCats = sebaCategories.filter((cat) => !HIDDEN_SEBAS.includes(cat.name));
                const hasAny = visibleCats.some((cat) => (sebaSelections[cat.id] || []).length > 0);
                if (!hasAny) {
                  return (
                    <View style={s.confirmNoSeba}>
                      <Text style={s.confirmNoSebaTxt}>No beddhas selected. You can still submit — selections can be updated later.</Text>
                    </View>
                  );
                }
                return visibleCats
                  .filter((cat) => (sebaSelections[cat.id] || []).length > 0)
                  .map((cat) => {
                    const nums = [...(sebaSelections[cat.id] || [])].sort((a, b) => a - b);
                    return (
                      <View key={cat.id} style={s.confirmSebaRow}>
                        <Text style={s.confirmSebaName}>{isOdia && cat.name_or ? cat.name_or : cat.name}</Text>
                        <View style={s.confirmBeddhaWrap}>
                          {nums.map((n) => (
                            <View key={n} style={s.confirmBeddhaPill}>
                              <Text style={s.confirmBeddhaTxt}>{n}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  });
              })()}
            </ScrollView>

            <View style={s.confirmModalActions}>
              <TouchableOpacity
                style={s.confirmCancelBtn}
                onPress={() => setShowSubmitModal(false)}
                activeOpacity={0.7}
                disabled={saving}
              >
                <Text style={s.confirmCancelTxt}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.confirmSubmitBtn, saving && s.nextBtnDis]}
                onPress={() => { setShowSubmitModal(false); submit(); }}
                activeOpacity={0.85}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Check color="#fff" size={15} strokeWidth={3} /><Text style={s.confirmSubmitTxt}>Confirm &amp; Submit</Text></>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSebaConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSebaConfirmModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.confirmModal}>
            <View style={s.confirmModalHeader}>
              <View style={s.confirmModalIconWrap}>
                <Check color={T.green} size={22} strokeWidth={2.5} />
              </View>
              <Text style={s.confirmModalTitle}>Confirm Seba Selection</Text>
              <Text style={s.confirmModalSub}>Review your selected beddhas before continuing.</Text>
            </View>

            <ScrollView style={s.confirmModalBody} showsVerticalScrollIndicator={false}>
              {(() => {
                const visibleCats = sebaCategories.filter((cat) => !HIDDEN_SEBAS.includes(cat.name));
                const hasAny = visibleCats.some((cat) => (sebaSelections[cat.id] || []).length > 0);
                if (!hasAny) {
                  return (
                    <View style={s.confirmNoSeba}>
                      <Text style={s.confirmNoSebaTxt}>No beddhas selected. You can update your selection later.</Text>
                    </View>
                  );
                }
                return visibleCats
                  .filter((cat) => (sebaSelections[cat.id] || []).length > 0)
                  .map((cat) => {
                    const nums = [...(sebaSelections[cat.id] || [])].sort((a, b) => a - b);
                    return (
                      <View key={cat.id} style={s.confirmSebaRow}>
                        <Text style={s.confirmSebaName}>{isOdia && cat.name_or ? cat.name_or : cat.name}</Text>
                        <View style={s.confirmBeddhaWrap}>
                          {nums.map((n) => (
                            <View key={n} style={s.confirmBeddhaPill}>
                              <Text style={s.confirmBeddhaTxt}>{n}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  });
              })()}
            </ScrollView>

            <View style={s.confirmModalActions}>
              <TouchableOpacity
                style={s.confirmCancelBtn}
                onPress={() => setShowSebaConfirmModal(false)}
                activeOpacity={0.7}
              >
                <Text style={s.confirmCancelTxt}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.confirmSubmitBtn}
                onPress={confirmSebaAndAdvance}
                activeOpacity={0.85}
              >
                <Check color="#fff" size={15} strokeWidth={3} />
                <Text style={s.confirmSubmitTxt}>Confirm &amp; Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Submit Error Modal ────────────────────────────── */}
      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.confirmModal, { maxWidth: 360 }]}>
            <View style={[s.confirmModalHeader, { paddingBottom: 12 }]}>
              <View style={[s.confirmModalIconWrap, { backgroundColor: T.redBg, borderColor: T.redLine }]}>
                <AlertCircle color={T.red} size={22} strokeWidth={2} />
              </View>
              <Text style={[s.confirmModalTitle, { color: T.red }]}>Submission Failed</Text>
              <Text style={s.confirmModalSub}>There was a problem saving your profile. Please try again.</Text>
            </View>
            <View style={[s.confirmErrBanner, { margin: 0, marginHorizontal: 20, marginBottom: 16 }]}>
              <Text style={s.confirmErrTxt}>{submitError}</Text>
            </View>
            <View style={[s.confirmModalActions, { paddingBottom: 20 }]}>
              <TouchableOpacity
                style={[s.confirmSubmitBtn, { backgroundColor: T.red }]}
                onPress={() => setShowErrorModal(false)}
                activeOpacity={0.85}
              >
                <Text style={s.confirmSubmitTxt}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NameInput({
  value, onChange, placeholder, error,
}: {
  value: string; onChange: (v: string) => void; placeholder: string; error?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[s.nameInput, focused && s.nameInputFocused, error && s.nameInputErr]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={T.inkQuaternary}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      autoCapitalize="words"
    />
  );
}

function ToggleRow({
  label, desc, value, onChange,
}: {
  label: string; desc: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <TouchableOpacity style={s.toggleRow} onPress={() => onChange(!value)} activeOpacity={0.8}>
      <View style={s.toggleText}>
        <Text style={s.toggleLabel}>{label}</Text>
        <Text style={s.toggleDesc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: T.line, true: T.primaryLight }}
        thumbColor={value ? T.primary : '#fff'}
      />
    </TouchableOpacity>
  );
}

// ─── Father search component ──────────────────────────────────────────────────

interface SebayatOption {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
}

function FatherSearchField({
  value,
  linkedId,
  onChange,
  error,
}: {
  value: string;
  linkedId: string;
  onChange: (name: string, id: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SebayatOption[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('sebayats')
      .select('id, full_name, first_name, last_name, date_of_birth')
      .or(`full_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .in('profile_status', ['submitted', 'resubmitted', 'approved'])
      .limit(20);
    setResults(data || []);
    setSearching(false);
  }, []);

  function handleQueryChange(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 280);
  }

  function select(item: SebayatOption) {
    onChange(item.full_name || [item.first_name, item.last_name].filter(Boolean).join(' '), item.id);
    setOpen(false);
    setQuery('');
    setResults([]);
  }

  function clearLink() {
    onChange('', '');
    setManualMode(false);
  }

  const linked = !!linkedId;
  const hasManualValue = !linked && !!value;

  return (
    <View style={p.fieldWrap}>
      <Label text="Father's Name" required />

      {manualMode && !linked ? (
        <View style={fs.manualRow}>
          <TextInput
            style={[fs.manualInput, !!error && p.inputErr]}
            value={value}
            onChangeText={(v) => onChange(v, '')}
            placeholder="Full name"
            placeholderTextColor={T.inkQuaternary}
            autoCapitalize="words"
            autoFocus
          />
          <TouchableOpacity
            style={fs.manualSearch}
            onPress={() => { setManualMode(false); setOpen(true); setQuery(value); handleQueryChange(value); }}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Search color={T.primary} size={16} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[fs.trigger, !!error && fs.triggerErr, linked && fs.triggerLinked, hasManualValue && fs.triggerManual]}
          onPress={() => { if (!linked) setOpen(true); }}
          activeOpacity={linked ? 1 : 0.75}
        >
          {linked ? (
            <>
              <Link color={T.primary} size={15} style={{ marginRight: 8 }} />
              <Text style={fs.triggerLinkedTxt} numberOfLines={1}>{value || 'Linked'}</Text>
              <TouchableOpacity onPress={clearLink} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={T.inkTertiary} size={16} />
              </TouchableOpacity>
            </>
          ) : hasManualValue ? (
            <>
              <Text style={fs.triggerTxt} numberOfLines={1}>{value}</Text>
              <TouchableOpacity onPress={() => onChange('', '')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={T.inkTertiary} size={16} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Search color={T.inkQuaternary} size={15} style={{ marginRight: 8 }} />
              <Text style={fs.triggerPh} numberOfLines={1}>Search registered sebayat</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {!linked && !manualMode && (
        <TouchableOpacity onPress={() => setManualMode(true)} style={fs.typeLink} activeOpacity={0.7}>
          <Text style={fs.typeLinkTxt}>Type manually instead</Text>
        </TouchableOpacity>
      )}
      {!linked && manualMode && (
        <TouchableOpacity onPress={() => setManualMode(false)} style={fs.typeLink} activeOpacity={0.7}>
          <Text style={fs.typeLinkTxt}>Search registered sebayat instead</Text>
        </TouchableOpacity>
      )}

      <ErrMsg msg={error} />

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={fs.overlay}>
          <View style={fs.sheet}>
            <View style={fs.sheetHead}>
              <Text style={fs.sheetTitle}>Search Father</Text>
              <TouchableOpacity onPress={() => setOpen(false)} style={fs.sheetClose}>
                <X color={T.inkSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <View style={fs.searchRow}>
              <Search color={T.inkTertiary} size={16} />
              <TextInput
                style={fs.searchInput}
                value={query}
                onChangeText={handleQueryChange}
                placeholder="Search by name…"
                placeholderTextColor={T.inkQuaternary}
                autoFocus
                autoCapitalize="words"
              />
              {searching && <ActivityIndicator color={T.primary} size="small" />}
            </View>

            {query.trim().length > 0 && query.trim().length < 2 && (
              <Text style={fs.hint}>Type at least 2 characters to search</Text>
            )}

            <ScrollView style={fs.list} keyboardShouldPersistTaps="handled">
              {results.length === 0 && query.trim().length >= 2 && !searching && (
                <View style={fs.emptyWrap}>
                  <Text style={fs.emptyTxt}>No registered sebayat found.</Text>
                  <TouchableOpacity
                    onPress={() => {
                      onChange(query.trim(), '');
                      setOpen(false);
                      setQuery('');
                    }}
                    style={fs.useManual}
                  >
                    <Text style={fs.useManualTxt}>Use "{query.trim()}" as manual entry</Text>
                  </TouchableOpacity>
                </View>
              )}
              {results.map((item) => {
                const displayName = item.full_name || [item.first_name, item.last_name].filter(Boolean).join(' ');
                return (
                  <TouchableOpacity key={item.id} style={fs.resultItem} onPress={() => select(item)} activeOpacity={0.75}>
                    <View style={fs.resultAvatar}>
                      <User color={T.primary} size={16} />
                    </View>
                    <View style={fs.resultInfo}>
                      <Text style={fs.resultName}>{displayName}</Text>
                      {item.date_of_birth ? <Text style={fs.resultSub}>DOB: {item.date_of_birth}</Text> : null}
                    </View>
                    <Check color={T.primary} size={14} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// FatherSearchField styles
const fs = StyleSheet.create({
  trigger: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: T.surface,
  },
  triggerErr: { borderColor: T.red, backgroundColor: T.redBg },
  triggerLinked: { borderColor: T.primary, backgroundColor: T.primaryBg },
  triggerManual: { borderColor: T.lineMid },
  triggerTxt: { flex: 1, fontSize: 15, fontFamily: 'Poppins_400Regular', color: T.ink },
  triggerPh: { flex: 1, fontSize: 15, fontFamily: 'Poppins_400Regular', color: T.inkQuaternary },
  triggerLinkedTxt: { flex: 1, fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: T.primary },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1.5,
    borderColor: T.primary,
    borderRadius: 10,
    backgroundColor: T.primaryBg,
    overflow: 'hidden',
  },
  manualInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: T.ink,
  },
  manualSearch: {
    width: 44,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: T.primaryBorder,
  },
  typeLink: { marginTop: 5 },
  typeLinkTxt: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: T.inkTertiary, textDecorationLine: 'underline' },
  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  sheetTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: T.ink },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1.5,
    borderColor: T.primaryBorder,
    borderRadius: 10,
    backgroundColor: T.primaryBg,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: T.ink,
  },
  hint: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: T.inkQuaternary,
    textAlign: 'center',
    marginBottom: 12,
  },
  list: { paddingHorizontal: 16 },
  emptyWrap: { paddingVertical: 24, alignItems: 'center', gap: 12 },
  emptyTxt: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: T.inkTertiary },
  useManual: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: T.primaryBorder,
    backgroundColor: T.primaryBg,
  },
  useManualTxt: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: T.primary },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  resultAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: T.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.primaryBorder,
  },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: T.ink },
  resultSub: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: T.inkTertiary, marginTop: 1 },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.canvas },
  loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadTxt: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: T.inkTertiary },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: T.surface,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  headerLeft: { gap: 1 },
  headerEye: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: T.primary, letterSpacing: 0.5 },
  headerTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: T.ink },
  headerPill: {
    backgroundColor: T.primaryBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.primaryBorder,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  headerPillTxt: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: T.primary },

  // Progress
  progressBar: { height: 3, backgroundColor: T.line },
  progressFill: { height: 3, backgroundColor: T.primary },

  // Step indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    backgroundColor: T.surface,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepConnector: { width: 28, height: 2, backgroundColor: T.stepTodo },
  stepConnectorDone: { backgroundColor: T.stepDone },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.surface,
    borderWidth: 2,
    borderColor: T.stepTodo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { borderColor: T.stepActive, backgroundColor: T.primaryBg },
  stepDotDone: { borderColor: T.stepDone, backgroundColor: T.stepDone },
  stepN: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: T.inkQuaternary },
  stepNActive: { color: T.primary },
  stepName: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    color: T.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingBottom: 12,
    backgroundColor: T.surface,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },

  // Change-request mode — single section badge replacing the full stepper
  changeRequestStepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  changeRequestStepText: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: '#92400e',
  },
  changeRequestStepName: {
    fontFamily: 'Poppins_700Bold',
    color: '#78350f',
  },

  // Scroll / content
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48 },

  // Avatar
  avatar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: T.surface,
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: T.canvas,
    borderWidth: 1.5,
    borderColor: T.line,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTitle: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: T.ink },
  avatarSub: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: T.inkQuaternary, marginTop: 2 },

  // Name grid
  fieldWrap: { marginBottom: 20 },
  nameGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  nameCell: { width: '48%' },
  nameInput: {
    height: 46,
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: T.ink,
    backgroundColor: T.surface,
  },
  nameInputFocused: { borderColor: T.primary, backgroundColor: T.primaryBg },
  nameInputErr: { borderColor: T.red, backgroundColor: T.redBg },

  // DOB trigger button
  dobTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dobTriggerTxt: { flex: 1, fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: T.ink },
  dobTriggerPh: { flex: 1, fontSize: 15, fontFamily: 'Poppins_400Regular', color: T.inkQuaternary },
  dobModalFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  dobModalDone: {
    backgroundColor: T.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  dobModalDoneTxt: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: '#fff' },

  // Upload row
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 10,
    padding: 14,
    backgroundColor: T.canvas,
  },
  uploadIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: T.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: T.ink },
  uploadSub: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: T.inkQuaternary, marginTop: 1 },
  idCardNotice: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: T.inkSecondary, marginBottom: 16, lineHeight: 20 },
  lockedPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.canvas,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: T.line,
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 0,
    opacity: 0.85,
  },
  lockedPhoneTxt: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Poppins_500Medium',
    color: T.ink,
    marginLeft: 12,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: T.line,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  lockedBadgeTxt: {
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
    color: T.inkTertiary,
    letterSpacing: 0.3,
  },
  lockedInput: {
    backgroundColor: T.surfaceHover,
    borderColor: T.line,
    borderStyle: 'dashed',
  },
  whatsappLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sameAsPrimaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sameCheckBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: T.line,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sameCheckBoxOn: {
    backgroundColor: T.primary,
    borderColor: T.primary,
  },
  sameCheckLabel: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
    color: T.inkSecondary,
  },
  lockedPhoneHint: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: T.inkQuaternary,
    marginTop: 6,
    lineHeight: 16,
  },
  idDocRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },

  // Joining Nijog card
  joiningHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: T.primaryBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  joiningHintTxt: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: T.primary,
  },
  joiningCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  joiningCheckBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: T.line,
    backgroundColor: T.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joiningCheckBoxOn: {
    backgroundColor: T.primary,
    borderColor: T.primary,
  },
  joiningCheckLabel: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    color: T.ink,
    flex: 1,
  },
  joiningPickerLabel: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    color: T.inkTertiary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  joiningTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: T.line,
    paddingBottom: 10,
  },
  joiningTriggerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joiningTriggerTxt: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: T.ink,
  },
  joiningTriggerPh: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    color: T.inkQuaternary,
    letterSpacing: 1,
  },

  // DOB picker (legacy — modal now)
  dobSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    backgroundColor: T.greenBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  dobSelectedTxt: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: T.green },
  dobClear: { marginLeft: 8 },
  dobClearTxt: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: T.inkTertiary, textDecorationLine: 'underline' },
  dobRow: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: T.surface,
  },
  dobSeg: { flex: 1 },
  dobSegHdr: {
    textAlign: 'center',
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
    color: T.inkQuaternary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingVertical: 8,
    backgroundColor: T.canvas,
  },
  dobList: { height: 160 },
  dobItem: {
    paddingVertical: 9,
    alignItems: 'center',
  },
  dobItemSel: { backgroundColor: T.primaryBg },
  dobItemTxt: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: T.inkSecondary },
  dobItemTxtSel: { fontFamily: 'Poppins_700Bold', color: T.primary },
  dobSepLine: { width: 1, backgroundColor: T.line },

  // Info card
  infoCard: {
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 14,
    backgroundColor: T.surface,
    overflow: 'hidden',
    marginBottom: 20,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: T.canvas,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  infoCardTitle: {
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
    color: T.inkSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  infoCardBody: {
    padding: 16,
    gap: 0,
  },
  infoCardDivider: {
    height: 1,
    backgroundColor: T.line,
    marginVertical: 16,
  },

  // Toggles
  toggleGroup: {
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: T.surface,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  toggleSep: { height: 1, backgroundColor: T.line, marginHorizontal: 14 },
  toggleText: { flex: 1, gap: 1 },
  toggleLabel: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: T.ink },
  radioGroup: { gap: 10 },
  radioRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: T.line, borderRadius: 12,
    padding: 14, backgroundColor: T.surface,
  },
  radioRowSelected: { borderColor: T.primary, backgroundColor: T.primary + '08' },
  radioCircle: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  radioCircleSelected: { borderColor: T.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.primary },
  radioLabel: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: T.ink },
  radioLabelSelected: { color: T.primary },
  radioDesc: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: T.inkTertiary, marginTop: 1 },
  toggleDesc: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: T.inkQuaternary },

  // 2-col row
  row2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  col2: { width: '47.5%' },

  // Cards (child / occupation)
  card: {
    backgroundColor: T.surface,
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: T.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardNumTxt: { fontSize: 11, fontFamily: 'Poppins_700Bold', color: T.primary },
  cardHeadTxt: { flex: 1, fontSize: 13, fontFamily: 'Poppins_700Bold', color: T.inkSecondary },

  // Delete button
  delBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: T.redBg,
    borderWidth: 1,
    borderColor: T.redLine,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Add row
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: T.primaryBorder,
    borderStyle: 'dashed',
    borderRadius: 10,
    backgroundColor: T.primaryBg,
    marginBottom: 20,
  },
  addRowTxt: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: T.primary },

  // Extra phone
  extraPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Social
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 10,
    backgroundColor: T.surface,
    overflow: 'hidden',
    height: 50,
  },
  socialRowFilled: { borderColor: T.primary },
  socialIcon: {
    width: 50,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: T.line,
  },
  socialInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: T.ink,
  },

  // Address
  addrHeading: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    color: T.ink,
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },

  // Seba step
  sebaLoadWrap: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  sebaLoadTxt: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: T.inkTertiary },
  sebaSelCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.primaryBg,
    borderWidth: 1,
    borderColor: T.primaryBorder,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 16,
  },
  sebaSelCountTxt: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: T.primary },
  sebaEmpty: { paddingVertical: 48, alignItems: 'center' },
  sebaEmptyTxt: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: T.inkTertiary },

  // Seba category card
  sebaCatCard: {
    backgroundColor: T.surface,
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sebaCatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: T.canvas,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  sebaCatName: { flex: 1, fontSize: 13, fontFamily: 'Poppins_700Bold', color: T.inkSecondary, letterSpacing: 0.3 },
  sebaCatBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sebaCatSelBadge: {
    backgroundColor: T.primary,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sebaCatSelBadgeTxt: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: '#fff' },
  sebaCatCountBadge: {
    backgroundColor: T.line,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sebaCatCountTxt: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: T.inkTertiary },

  // Beddha grid
  sebaBeddhaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 14,
    gap: 8,
  },

  // Normal beddha pill
  beddha: {
    width: 44,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: T.line,
    backgroundColor: T.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  beddhaSelected: {
    backgroundColor: T.primary,
    borderColor: T.primary,
  },
  beddhaCheckDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  beddhaNum: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    color: T.inkSecondary,
  },
  beddhaNumSelected: { color: '#fff', fontFamily: 'Poppins_700Bold' },

  // Nijog-assigned (disabled) beddha pill
  beddhaDisabled: {
    width: 44,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  beddhaDisabledNum: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
    color: '#9CA3AF',
  },
  beddhaDisabledLabel: {
    position: 'absolute',
    top: 1,
    right: 3,
    fontSize: 7,
    fontFamily: 'Poppins_700Bold',
    color: '#6B7280',
  },

  // Legend
  sebaCatLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendTxt: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: T.inkTertiary },

  // Ready card
  readyCard: {
    backgroundColor: T.greenBg,
    borderWidth: 1.5,
    borderColor: T.greenLine,
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  readyCheck: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: T.green },
  readyTxt: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: '#166534', lineHeight: 20, textAlign: 'center' },

  // Admin remarks banner (shown when changes_requested)
  remarksBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  remarksBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  remarksBannerTitle: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: '#92400e',
  },
  remarksBannerText: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: '#78350f',
    lineHeight: 20,
  },
  remarksBannerRejected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  remarksBannerTitleRejected: {
    color: '#991B1B',
  },
  remarksBannerTextRejected: {
    color: '#7F1D1D',
  },

  // Submit error
  errBanner: {
    backgroundColor: T.redBg,
    borderWidth: 1,
    borderColor: T.redLine,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errBannerTxt: { fontSize: 13, color: T.red, fontFamily: 'Poppins_400Regular' },

  // Nav
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: T.line,
    marginTop: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: T.line,
    backgroundColor: T.surface,
  },
  backBtnTxt: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: T.inkSecondary },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    minWidth: 148,
    justifyContent: 'center',
    shadowColor: T.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  nextBtnDis: { opacity: 0.55, shadowOpacity: 0 },
  nextBtnTxt: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  // ── Submit Confirmation Modal ──────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  confirmModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 32,
  },
  confirmModalHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  confirmModalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  confirmModalTitle: {
    fontSize: 17,
    fontFamily: 'Poppins_700Bold',
    color: T.ink,
    marginBottom: 4,
  },
  confirmModalSub: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: T.inkSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  confirmModalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: 320,
  },
  confirmNoSeba: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  confirmNoSebaTxt: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: T.inkSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  confirmSebaRow: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  confirmSebaName: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: T.ink,
    marginBottom: 8,
  },
  confirmBeddhaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  confirmBeddhaPill: {
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  confirmBeddhaTxt: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    color: '#166534',
  },
  confirmErrBanner: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 10,
  },
  confirmErrTxt: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: '#DC2626',
  },
  confirmModalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelTxt: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: T.inkSecondary,
  },
  confirmSubmitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: T.green,
    paddingVertical: 14,
    borderRadius: 10,
    shadowColor: T.green,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmSubmitTxt: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: '#fff',
  },
});
