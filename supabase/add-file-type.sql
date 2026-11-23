-- Cascade Tech: run this once in Supabase -> SQL Editor if you already ran setup.sql.
-- Adds the file type column used by bulk import and the type filter.

alter table public.resources
  add column if not exists file_type text not null default 'other';

-- Fill in the type for materials you already uploaded, based on the file extension.
update public.resources set file_type = case
  when file_name ~* '\.pdf$' then 'pdf'
  when file_name ~* '\.(py|pyw)$' then 'python'
  when file_name ~* '\.ipynb$' then 'notebook'
  when file_name ~* '\.(html|htm|css|php)$' then 'web'
  when file_name ~* '\.(js|mjs|jsx|ts|tsx|java|c|cpp|h|hpp|cs|go|rs|rb|kt|swift|sh|bash|bat|ps1|sql|lua|r|pl)$' then 'code'
  when file_name ~* '\.(doc|docx|txt|md|rtf|odt|ppt|pptx|odp)$' then 'docs'
  when file_name ~* '\.(csv|tsv|json|xlsx|xls|xml|yaml|yml)$' then 'data'
  when file_name ~* '\.(exe|msi|apk|jar|dmg|deb|appimage)$' then 'programs'
  when file_name ~* '\.(zip|rar|7z|tar|gz|tgz)$' then 'archives'
  when file_name ~* '\.(png|jpg|jpeg|gif|svg|webp|mp4|mkv|webm|mp3|wav)$' then 'media'
  else 'other'
end
where file_type = 'other';
